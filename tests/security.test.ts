import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import type { Router } from 'express';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { env } from '../server/env.js';
import { AUTH_COOKIE, cookieOptions } from '../server/middleware/auth.js';
import { errorHandler } from '../server/middleware/errors.js';
import { describeError, redact } from '../server/logging.js';
import { productionEnvProblems } from '../server/productionEnv.js';
import { providerStatus, sendEmail } from '../server/services/emailService.js';
import { orderToken } from '../server/services/orderToken.js';
import { HSTS, SITE_CSP } from '../server/securityHeaders.js';
import { adminRouter } from '../server/routes/admin/index.js';
import { authRouter } from '../server/routes/admin/auth.js';
import { ordersRouter } from '../server/routes/admin/orders.js';
import { settingsRouter } from '../server/routes/admin/settings.js';
import { emailsRouter } from '../server/routes/admin/emails.js';
import { analyticsRouter } from '../server/routes/admin/analytics.js';
import { customersRouter } from '../server/routes/admin/customers.js';
import { campaignsRouter } from '../server/routes/admin/campaigns.js';
import { menuRouter } from '../server/routes/admin/menu.js';
import { AdminUserModel } from '../server/models/AdminUser.js';
import { CustomerModel } from '../server/models/Customer.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { RateLimitModel } from '../server/models/RateLimit.js';
import { nextOpenDate, orderBody, resetDb } from './helpers.js';

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());
afterAll(disconnectDb);

async function login() {
  const agent = request.agent(app);
  await agent
    .post('/api/admin/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .expect(200);
  return agent;
}

// ------------------------------------------------------------------ auth

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle: Router & { stack?: Layer[] };
};

/** Every route registered on an Express router (method + path). */
function routesOf(router: Router, prefix = ''): Array<{ method: string; path: string }> {
  return (router.stack as unknown as Layer[]).flatMap((l) =>
    l.route
      ? Object.keys(l.route.methods).map((m) => ({ method: m, path: prefix + l.route!.path }))
      : [],
  );
}

const MOUNTED: Array<[string, Router]> = [
  ['/orders', ordersRouter],
  ['/settings', settingsRouter],
  ['/emails', emailsRouter],
  ['/analytics', analyticsRouter],
  ['/customers', customersRouter],
  ['/campaigns', campaignsRouter],
  ['/menu', menuRouter],
];

describe('every /api/admin route requires a session', () => {
  it('this list covers every router mounted on /api/admin', () => {
    const subRouters = (adminRouter.stack as unknown as Layer[])
      .map((l) => l.handle)
      .filter((h) => Array.isArray(h.stack));
    expect(new Set(subRouters)).toEqual(new Set([authRouter, ...MOUNTED.map(([, r]) => r)]));
  });

  const PUBLIC = new Set(['post /login', 'post /logout', 'get /me']);
  const routes = [
    ...routesOf(authRouter),
    ...MOUNTED.flatMap(([prefix, r]) => routesOf(r, prefix)),
  ];

  it('found the admin routes', () => {
    expect(routes.length).toBeGreaterThan(25);
  });

  it.each(routes.filter((r) => !PUBLIC.has(`${r.method} ${r.path}`)))(
    'unauthenticated $method $path → 401',
    async ({ method, path }) => {
      const url = `/api/admin${path.replace(/:id\b/g, 'a'.repeat(24))}`;
      const client = request(app) as unknown as Record<string, (u: string) => request.Test>;
      const res = await client[method](url).send({});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    },
  );

  it('a forged or tampered token is rejected', async () => {
    const admin = await AdminUserModel.findOne().lean();
    const payload = { sub: String(admin!._id), email: admin!.email, v: 0, at: 0 };
    const forged = jwt.sign(payload, 'not-the-secret');
    await request(app)
      .get('/api/admin/orders')
      .set('Cookie', `${AUTH_COOKIE}=${forged}`)
      .expect(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...payload, at: Math.floor(Date.now() / 1000) })).toString('base64url')}.`;
    await request(app).get('/api/admin/orders').set('Cookie', `${AUTH_COOKIE}=${none}`).expect(401);
  });
});

describe('session cookie', () => {
  it('is httpOnly, SameSite=Strict, short-lived, and Secure in production', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
      .expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Max-Age=43200/);
    const desc = Object.getOwnPropertyDescriptor(env, 'isProd')!;
    Object.defineProperty(env, 'isProd', { value: true, configurable: true });
    try {
      expect(cookieOptions()).toMatchObject({ secure: true, httpOnly: true, sameSite: 'strict' });
    } finally {
      Object.defineProperty(env, 'isProd', desc);
    }
  });

  async function tokenFor(ageS: number, authAgeS: number) {
    const admin = await AdminUserModel.findOne({ email: process.env.ADMIN_EMAIL }).lean();
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        sub: String(admin!._id),
        email: admin!.email,
        v: admin!.tokenVersion ?? 0,
        at: now - authAgeS,
        iat: now - ageS,
      },
      env.jwtSecret,
      { expiresIn: 12 * 3600 - ageS },
    );
  }

  it('slides: an active session older than 15 minutes gets a fresh cookie', async () => {
    const fresh = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${AUTH_COOKIE}=${await tokenFor(60, 60)}`)
      .expect(200);
    expect(fresh.headers['set-cookie']).toBeUndefined();
    const old = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${AUTH_COOKIE}=${await tokenFor(20 * 60, 3 * 3600)}`)
      .expect(200);
    expect(old.body.admin.email).toBe(process.env.ADMIN_EMAIL);
    expect(String(old.headers['set-cookie'])).toMatch(new RegExp(`${AUTH_COOKIE}=ey`));
  });

  it('ends 7 days after login however active the session is', async () => {
    await request(app)
      .get('/api/admin/orders')
      .set('Cookie', `${AUTH_COOKIE}=${await tokenFor(60, 8 * 24 * 3600)}`)
      .expect(401);
  });

  it('logout clears the cookie', async () => {
    const a = await login();
    const res = await a.post('/api/admin/logout').expect(200);
    expect(String(res.headers['set-cookie'])).toMatch(
      new RegExp(`${AUTH_COOKIE}=;.*Expires=Thu, 01 Jan 1970`),
    );
    await a.get('/api/admin/orders').expect(401);
  });
});

describe('login rate limiting (Mongo-backed, works across serverless instances)', () => {
  const prev = process.env.K233_TEST_RATE_LIMIT;
  beforeEach(async () => {
    process.env.K233_TEST_RATE_LIMIT = '1';
    await RateLimitModel.deleteMany({});
  });
  afterEach(async () => {
    process.env.K233_TEST_RATE_LIMIT = prev;
    await RateLimitModel.deleteMany({});
  });

  const attempt = (ip: string, password: string) =>
    request(app)
      .post('/api/admin/login')
      .set('X-Forwarded-For', ip)
      .send({ email: process.env.ADMIN_EMAIL, password });

  it('locks a network out after 10 failed attempts, even with the right password', async () => {
    for (let i = 0; i < 10; i++) await attempt('203.0.113.7', 'wrong-password').expect(401);
    const blocked = await attempt('203.0.113.7', process.env.ADMIN_PASSWORD!).expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    // Counters live in MongoDB, not in process memory.
    expect(await RateLimitModel.countDocuments()).toBeGreaterThan(0);
  });

  it('locks the account after 10 failures spread across many networks', async () => {
    for (let i = 0; i < 10; i++) await attempt(`198.51.100.${i + 1}`, 'nope-nope').expect(401);
    await attempt('198.51.100.200', process.env.ADMIN_PASSWORD!).expect(429);
  });

  it('successful logins do not count', async () => {
    for (let i = 0; i < 12; i++)
      await attempt('192.0.2.1', process.env.ADMIN_PASSWORD!).expect(200);
  });
});

// ------------------------------------------------------------------ input

describe('input validation', () => {
  it('rejects MongoDB operator injection', async () => {
    await request(app)
      .post('/api/admin/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
      .expect(400);
    const a = await login();
    await a.get('/api/admin/customers?q[$regex]=.*').expect(400);
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    await request(app).get('/api/orders/233-0001?t[$ne]=x').expect(404);
  });

  it('enforces maximum lengths on customer text', async () => {
    const tooLong = [
      { name: 'A'.repeat(81) },
      { email: `${'a'.repeat(115)}@x.com` },
      { phone: '5085551234'.repeat(4) },
      { notes: 'n'.repeat(501) },
      { pickupWindowId: 'w'.repeat(21) },
      {
        items: [{ slug: 'ice-kenkey', quantity: 1, selections: [], notes: 'x'.repeat(1000) }],
      },
    ];
    for (const patch of tooLong)
      await request(app).post('/api/orders').send(orderBody(patch)).expect(400);
  });

  it('turns line breaks and control characters in names into spaces', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ name: 'Ama\r\nBcc: x@y.z\u0000 Mensah' }))
      .expect(201);
    expect(res.body.order.customerName).toBe('Ama Bcc: x@y.z Mensah');
  });

  it('limits the request body size without leaking internals', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(150_000) }))
      .expect(413);
    expect(res.body).toEqual({ error: 'Request is too large', code: 'TOO_LARGE' });
  });

  it('keeps server-side pricing authoritative', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ total: 1, subtotal: 1, items: [{ ...orderBody().items[1], price: 1 }] }))
      .expect(201);
    expect(res.body.order.total).toBeGreaterThan(100);
  });
});

// ------------------------------------------------------------------ output

describe('output escaping', () => {
  it('escapes customer text in owner and customer emails', async () => {
    await request(app)
      .post('/api/orders')
      .send(
        orderBody({
          name: '<script>alert(1)</script> Mensah',
          notes: '<img src=x onerror=alert(1)>',
          items: [{ ...orderBody().items[1], notes: '"><svg onload=alert(2)>' }],
        }),
      )
      .expect(201);
    const logs = await EmailLogModel.find().lean();
    expect(logs.length).toBe(2);
    for (const l of logs) {
      expect(l.html).not.toMatch(/<script|<img src=x|<svg/i);
      // No real tag may carry an event handler (escaped text like "&lt;img onerror=…" is fine).
      expect(l.html).not.toMatch(/<[^>]*\son(error|load)=/i);
    }
    const owner = logs.find((l) => l.type === 'owner_new_order')!;
    expect(owner.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Mensah');
    expect(owner.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  const msg = {
    subject: 'Hi',
    heading: '<b>Heading</b>',
    body: '<script>x()</script> **bold** javascript:alert(1) http://plain.example https://ok.example/a',
    imageUrl: '',
    ctaLabel: '',
    ctaUrl: '',
    segment: 'all_opted_in',
  };

  it('sanitizes the marketing body: escaped HTML, https-only links', async () => {
    const a = await login();
    const res = await a.post('/api/admin/campaigns/preview').send(msg).expect(200);
    const html: string = res.body.html;
    expect(html).not.toContain('<script>x()');
    expect(html).toContain('&lt;script&gt;x()&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Heading&lt;/b&gt;');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toMatch(/href="(javascript|http:\/\/plain)/);
    expect(html).toContain('href="https://ok.example/a"');
  });

  it('allows only https:, mailto: and tel: for admin-entered links', async () => {
    const a = await login();
    for (const ctaUrl of ['javascript:alert(1)', 'http://x.example', 'data:text/html,hi', '//x.y'])
      await a
        .post('/api/admin/campaigns/preview')
        .send({ ...msg, ctaLabel: 'Go', ctaUrl })
        .expect(400);
    for (const ctaUrl of ['https://x.example/menu', 'mailto:owner@x.example', 'tel:+15085551234'])
      await a
        .post('/api/admin/campaigns/preview')
        .send({ ...msg, ctaLabel: 'Go', ctaUrl })
        .expect(200);
    await a
      .post('/api/admin/campaigns/preview')
      .send({ ...msg, imageUrl: 'http://x.example/a.png' })
      .expect(400);

    const settings = (await a.get('/api/admin/settings').expect(200)).body.settings;
    await a
      .put('/api/admin/settings')
      .send({ ...settings, social: { ...settings.social, instagram: 'javascript:alert(1)' } })
      .expect(400);

    const item = (await a.get('/api/admin/menu').expect(200)).body.items[0];
    const { id, ...body } = item;
    await a
      .put(`/api/admin/menu/${id}`)
      .send({ ...body, image: '//evil.example/x.webp' })
      .expect(400);
  });

  it('neutralises spreadsheet formulas in CSV exports', async () => {
    await request(app)
      .post('/api/orders')
      .send(orderBody({ name: '=HYPERLINK("x")', notes: '+SUM(A1)' }))
      .expect(201);
    await CustomerModel.updateOne({}, { $set: { notes: '  -cmd', tags: ['@risky'] } });
    const a = await login();
    const prep = await a.get(`/api/admin/orders/prep-sheet.csv?date=${nextOpenDate()}`).expect(200);
    expect(prep.text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(prep.text).toContain(`"'+SUM(A1)"`);
    const customers = await a.get('/api/admin/customers/export.csv').expect(200);
    expect(customers.text).toContain(`"'  -cmd"`);
    expect(customers.text).toContain(`"'@risky"`);
  });
});

// ------------------------------------------------------------------ headers & errors

describe('headers', () => {
  it('API responses are locked down', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(res.headers['strict-transport-security']).toBe(HSTS);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS only allows SITE_URL', async () => {
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    const ok = await request(app).get('/api/health').set('Origin', env.siteUrl);
    expect(ok.headers['access-control-allow-origin']).toBe(env.siteUrl);
  });

  it('vercel.json serves the site CSP, HSTS and frame protection', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const all = Object.fromEntries(
      v.headers.flatMap((h) => h.headers.map((x) => [`${h.source} ${x.key}`, x.value])),
    );
    expect(all['/((?!api/).*) Content-Security-Policy']).toBe(SITE_CSP);
    expect(SITE_CSP).toMatch(/frame-ancestors 'none'/);
    expect(SITE_CSP).toMatch(/script-src 'self';/);
    expect(all['/(.*) Strict-Transport-Security']).toBe(HSTS);
    expect(all['/(.*) X-Frame-Options']).toBe('DENY');
  });
});

describe('errors and logs', () => {
  it('never returns stack traces or internal messages, and logs are redacted', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(c: number) {
        this.statusCode = c;
        return this;
      },
      json(b: unknown) {
        this.body = b;
        return this;
      },
    };
    const err = new Error(
      'E11000 duplicate key: { email: "kofi.mensah@example.org" } via mongodb+srv://k233app:S3cret@cluster/k233',
    );
    errorHandler(err, {} as never, res as never, () => undefined);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'Something went wrong. Please try again.',
      code: 'INTERNAL',
    });
    const logged = String(log.mock.calls[0][0]);
    expect(logged).not.toContain('kofi.mensah@example.org');
    expect(logged).not.toContain('S3cret');
    expect(logged).toContain('ko***@example.org');
  });

  it('redact() masks emails, phone numbers, URI credentials and tokens', () => {
    expect(redact('call (508) 555-0123 or ama@example.com')).toBe(
      'call ***-***-**** or am***@example.com',
    );
    expect(redact('mongodb://user:pass@host/db')).toBe('mongodb://***:***@host/db');
    expect(redact('GET /api/orders/233-0001?t=abcdefghijklmnop')).toBe(
      'GET /api/orders/233-0001?t=***',
    );
    expect(describeError('x')).toBe('x');
  });
});

// ------------------------------------------------------------------ tokens

describe('customer tokens', () => {
  it('order links need the exact signed token', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const t = orderToken('233-0001');
    expect(t).toHaveLength(32);
    await request(app).get(`/api/orders/233-0001?t=${t}`).expect(200);
    const flipped = t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A');
    await request(app).get(`/api/orders/233-0001?t=${flipped}`).expect(404);
    await request(app)
      .get(`/api/orders/233-0001?t=${t.slice(0, 31)}`)
      .expect(404);
    await request(app).get(`/api/orders/233-0002?t=${t}`).expect(404);
  });

  it('unsubscribe links need the customer id and their secret', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const c = (await CustomerModel.findOne().lean())!;
    const wrong = `${c._id}.${'A'.repeat(c.unsubscribeToken.length)}`;
    await request(app).post('/api/unsubscribe').send({ token: wrong }).expect(404);
    await request(app).post('/api/unsubscribe').send({ token: c.unsubscribeToken }).expect(404);
    expect((await CustomerModel.findById(c._id).lean())!.marketingConsent).toBe(true);
    await request(app)
      .post('/api/unsubscribe')
      .send({ token: `${c._id}.${c.unsubscribeToken}` })
      .expect(200);
    expect((await CustomerModel.findById(c._id).lean())!.marketingConsent).toBe(false);
  });

  it('marketing emails carry the id.secret unsubscribe token', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const c = (await CustomerModel.findOne().lean())!;
    const a = await login();
    await a
      .post('/api/admin/campaigns/send')
      .send({
        subject: 'Hi',
        heading: '',
        body: 'Hello',
        imageUrl: '',
        ctaLabel: '',
        ctaUrl: '',
        segment: 'all_opted_in',
      })
      .expect(201);
    const mail = await EmailLogModel.findOne({ type: 'marketing' }).lean();
    expect(mail!.html).toContain(`/unsubscribe?token=${c._id}.${c.unsubscribeToken}`);
  });
});

// ------------------------------------------------------------------ previews

describe('Vercel preview deployments', () => {
  const KEYS = ['VERCEL_ENV', 'MONGODB_URI', 'JWT_SECRET', 'SITE_URL', 'EMAIL_PROVIDER'] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
    Object.assign(process.env, {
      VERCEL_ENV: 'preview',
      JWT_SECRET: 'x'.repeat(40),
      SITE_URL: 'https://233kitchen.example',
      EMAIL_PROVIDER: 'gmail',
    });
  });
  afterEach(() => {
    for (const k of KEYS) process.env[k] = saved[k];
  });

  it('refuse the production database', () => {
    process.env.MONGODB_URI = 'mongodb+srv://u:p@cluster.example.net/k233?retryWrites=true';
    expect(productionEnvProblems().join()).toMatch(/must use a separate database/);
    process.env.MONGODB_URI = 'mongodb+srv://u:p@cluster.example.net/k233-preview';
    expect(productionEnvProblems()).toEqual([]);
  });

  it('never send email', async () => {
    expect(providerStatus()).toMatchObject({
      provider: 'none',
      label: 'disabled on preview deployments',
    });
    const r = await sendEmail({
      type: 'test',
      to: 'someone@example.org',
      subject: 'x',
      html: 'x',
      text: 'x',
    });
    expect(r).toMatchObject({ ok: false, status: 'failed' });
    expect(r.error).toMatch(/disabled on Vercel preview/);
  });
});
