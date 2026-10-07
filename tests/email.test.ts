import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { env } from '../server/env.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import {
  activeProvider,
  describeEmailConfig,
  providerStatus,
  sendEmail,
} from '../server/services/emailService.js';
import { orderBody, resetDb } from './helpers.js';

const KEYS = [
  'EMAIL_PROVIDER',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_HOST',
  'RESEND_API_KEY',
  'EMAIL_FROM',
] as const;
const saved: Record<string, string | undefined> = {};
const isProdDesc = Object.getOwnPropertyDescriptor(env, 'isProd')!;

/** Sets email env vars for one test (unset = empty). Never real credentials. */
function setEmailEnv(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) process.env[k] = vars[k] ?? '';
}
function setProd(on: boolean) {
  Object.defineProperty(env, 'isProd', { value: on, configurable: true, enumerable: true });
}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of KEYS) process.env[k] = saved[k];
  Object.defineProperty(env, 'isProd', isProdDesc);
  vi.restoreAllMocks();
});

describe('providerStatus() / activeProvider()', () => {
  it('uses dev previews when nothing is configured (dev)', () => {
    setEmailEnv({});
    expect(activeProvider()).toBe('dev');
    expect(providerStatus().misconfigured).toBeNull();
  });

  it('auto-detects Gmail SMTP from SMTP_USER + SMTP_PASS', () => {
    setEmailEnv({ SMTP_USER: 'kitchen@gmail.com', SMTP_PASS: 'app-pass' });
    const s = providerStatus();
    expect(s.provider).toBe('smtp');
    expect(s.label).toBe('smtp (Gmail)');
    expect(s.from).toBe('+233 Kitchen <kitchen@gmail.com>');
  });

  it('uses Resend when only RESEND_API_KEY is set', () => {
    setEmailEnv({ RESEND_API_KEY: 're_test' });
    expect(activeProvider()).toBe('resend');
  });

  it('flags EMAIL_PROVIDER=smtp without a password and does NOT silently fall back', () => {
    setEmailEnv({
      EMAIL_PROVIDER: 'smtp',
      SMTP_USER: 'kitchen@gmail.com',
      RESEND_API_KEY: 're_test',
    });
    const s = providerStatus();
    expect(s.provider).toBe('dev');
    expect(s.misconfigured).toBe('SMTP not configured (SMTP_PASS missing)');
  });

  it('flags EMAIL_PROVIDER=smtp with no credentials at all', () => {
    setEmailEnv({ EMAIL_PROVIDER: 'smtp' });
    expect(providerStatus().misconfigured).toBe(
      'SMTP not configured (SMTP_USER and SMTP_PASS missing)',
    );
  });

  it('treats partial SMTP credentials as SMTP requested', () => {
    setEmailEnv({ SMTP_USER: 'kitchen@gmail.com' });
    expect(providerStatus().misconfigured).toMatch(/SMTP not configured/);
  });

  it('flags EMAIL_PROVIDER=resend without an API key', () => {
    setEmailEnv({ EMAIL_PROVIDER: 'resend', SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x' });
    const s = providerStatus();
    expect(s.provider).toBe('dev');
    expect(s.misconfigured).toBe('Resend not configured (RESEND_API_KEY missing)');
  });

  it('flags an unknown EMAIL_PROVIDER', () => {
    setEmailEnv({ EMAIL_PROVIDER: 'sendgrid' });
    expect(providerStatus().misconfigured).toMatch(/Unknown EMAIL_PROVIDER "sendgrid"/);
  });

  it('in production a missing config means "none", never dev previews', () => {
    setProd(true);
    setEmailEnv({ EMAIL_PROVIDER: 'smtp' });
    expect(activeProvider()).toBe('none');
    setEmailEnv({});
    expect(activeProvider()).toBe('none');
  });

  it('startup summary names provider, From and owner, and never prints secrets', () => {
    setEmailEnv({
      SMTP_USER: 'kitchen@gmail.com',
      SMTP_PASS: 'super-secret-app-pass',
      RESEND_API_KEY: 're_secret_key',
    });
    const line = describeEmailConfig();
    expect(line).toBe(
      '📧 Email: smtp (Gmail) from +233 Kitchen <kitchen@gmail.com> → owner owner@233kitchen.test',
    );
    expect(line).not.toContain('super-secret-app-pass');
    expect(line).not.toContain('re_secret_key');
    setEmailEnv({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'kitchen@gmail.com' });
    expect(describeEmailConfig()).toMatch(/⚠️ {2}SMTP not configured \(SMTP_PASS missing\)/);
  });
});

afterAll(disconnectDb);

describe('sending with a misconfigured provider', () => {
  beforeEach(resetDb);

  const mail = {
    type: 'owner_new_order' as const,
    to: 'owner@233kitchen.test',
    subject: 'New order',
    html: '<p>hi</p>',
    text: 'hi',
  };

  it('records FAILED (resendable) with a clear error and warns on every attempt (dev)', async () => {
    setEmailEnv({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'kitchen@gmail.com' });
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const a = await sendEmail(mail);
    const b = await sendEmail(mail);
    expect(a).toMatchObject({
      ok: false,
      status: 'failed',
      error: 'SMTP not configured (SMTP_PASS missing). Email saved as dev preview only.',
    });
    expect(b.ok).toBe(false);
    const loud = warn.mock.calls.filter((c) =>
      String(c[0]).includes('⚠️  [email] SMTP not configured'),
    );
    expect(loud).toHaveLength(2);
    const logs = await EmailLogModel.find().lean();
    expect(logs.map((l) => l.status)).toEqual(['failed', 'failed']);
    expect(logs[0].error).toBe(
      'SMTP not configured (SMTP_PASS missing). Email saved as dev preview only.',
    );
  });

  it('in production logs an error saying the email was not sent', async () => {
    setProd(true);
    setEmailEnv({ EMAIL_PROVIDER: 'smtp' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await sendEmail(mail);
    expect(r.error).toBe('SMTP not configured (SMTP_USER and SMTP_PASS missing). Email not sent.');
    expect((await EmailLogModel.findOne().lean())?.status).toBe('failed');
  });

  it('still places the order, with both emails logged as failed before the response', async () => {
    setEmailEnv({ EMAIL_PROVIDER: 'smtp' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).post('/api/orders').send(orderBody()).expect(201);
    // The logs exist as soon as the response arrives, so emails were awaited before responding.
    const logs = await EmailLogModel.find({ orderNumber: res.body.order.number }).lean();
    expect(logs.map((l) => l.type).sort()).toEqual(['customer_order_received', 'owner_new_order']);
    expect(
      logs.every((l) => l.status === 'failed' && /SMTP not configured/.test(l.error ?? '')),
    ).toBe(true);
  });

  it('dev mode with nothing configured is a normal "sent_dev", not a failure', async () => {
    setEmailEnv({});
    const r = await sendEmail(mail);
    expect(r).toMatchObject({ ok: true, status: 'sent_dev' });
  });
});

describe('admin test email', () => {
  beforeEach(resetDb);

  async function login() {
    const agent = request.agent(app);
    await agent
      .post('/api/admin/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
      .expect(200);
    return agent;
  }

  it('requires admin auth', async () => {
    await request(app).post('/api/admin/settings/test-email').expect(401);
  });

  it('reports the provider and the exact error per recipient', async () => {
    setEmailEnv({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'kitchen@gmail.com' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const a = await login();
    const res = await a.post('/api/admin/settings/test-email').expect(200);
    expect(res.body.emailStatus.misconfigured).toBe('SMTP not configured (SMTP_PASS missing)');
    expect(res.body.results).toEqual([
      {
        to: 'owner@233kitchen.test',
        ok: false,
        status: 'failed',
        error: 'SMTP not configured (SMTP_PASS missing). Email saved as dev preview only.',
      },
    ]);
    expect(await EmailLogModel.countDocuments({ type: 'test', status: 'failed' })).toBe(1);

    const settings = await a.get('/api/admin/settings').expect(200);
    expect(settings.body.emailStatus.label).toBe('dev (previews only, NOT sent)');
    expect(JSON.stringify(settings.body)).not.toMatch(/SMTP_PASS=|re_/);
  });

  it('succeeds in dev preview mode', async () => {
    setEmailEnv({});
    const a = await login();
    const res = await a.post('/api/admin/settings/test-email').expect(200);
    expect(res.body.results[0]).toMatchObject({ ok: true, status: 'sent_dev', error: null });
  });
});
