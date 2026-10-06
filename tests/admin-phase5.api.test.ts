import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { CustomerModel } from '../server/models/Customer.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { OrderModel } from '../server/models/Order.js';
import { orderBody, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(disconnectDb);

async function login() {
  const agent = request.agent(app);
  await agent
    .post('/api/admin/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .expect(200);
  return agent;
}

async function seedOrders() {
  await request(app).post('/api/orders').send(orderBody()).expect(201); // Ama, opted in, $51
  await request(app)
    .post('/api/orders')
    .send(
      orderBody({
        name: 'Kojo Antwi',
        email: 'kojo@example.com',
        phone: '617-555-0101',
        marketingConsent: false,
        items: [{ slug: 'banku-grilled-tilapia', quantity: 1, selections: [] }],
      }),
    )
    .expect(201); // Kojo, not opted in, $25
}

describe('analytics', () => {
  it('summarises orders for the range, excluding cancelled', async () => {
    await seedOrders();
    const a = await login();
    const res = await a.get('/api/admin/analytics?range=4w').expect(200);
    expect(res.body.kpis.orders).toBe(2);
    expect(res.body.kpis.revenue).toBe(7600);
    expect(res.body.kpis.avgOrderValue).toBe(3800);
    expect(res.body.kpis.newCustomers).toBe(2);
    expect(res.body.kpis.pendingOrders).toBe(2);
    expect(res.body.weekly).toHaveLength(12);
    expect(res.body.bestSellers[0]).toMatchObject({
      name: 'Loaded Fried Rice with Chicken',
      quantity: 2,
    });
    expect(res.body.extras.find((e: { name: string }) => e.name === 'Extra plantain').count).toBe(
      2,
    );
    expect(res.body.upcoming.orders).toBe(2);

    await OrderModel.updateOne({ number: '233-0002' }, { $set: { status: 'cancelled' } });
    const after = await a.get('/api/admin/analytics?range=4w').expect(200);
    expect(after.body.kpis.orders).toBe(1);
    await a.get('/api/admin/analytics?range=custom&from=2026-01-01&to=2026-12-31').expect(200);
    await a.get('/api/admin/analytics?range=year').expect(400);
  });
});

describe('customers', () => {
  it('lists, filters by consent, tags, exports CSV and updates', async () => {
    await seedOrders();
    const a = await login();
    const all = await a.get('/api/admin/customers').expect(200);
    expect(all.body.total).toBe(2);
    const opted = await a.get('/api/admin/customers?consent=opted_in').expect(200);
    expect(opted.body.items.map((c: { email: string }) => c.email)).toEqual(['ama@example.com']);

    const kojo = all.body.items.find((c: { email: string }) => c.email === 'kojo@example.com');
    const upd = await a
      .patch(`/api/admin/customers/${kojo.id}`)
      .send({ tags: ['vip', 'VIP', 'church'], notes: 'Likes it spicy' })
      .expect(200);
    expect(upd.body.customer.tags).toEqual(['vip', 'church']);
    expect((await a.get('/api/admin/customers/tags').expect(200)).body.tags).toEqual([
      'church',
      'vip',
    ]);
    expect((await a.get('/api/admin/customers?tag=vip').expect(200)).body.total).toBe(1);

    const detail = await a.get(`/api/admin/customers/${kojo.id}`).expect(200);
    expect(detail.body.orders).toHaveLength(1);

    const csv = await a.get('/api/admin/customers/export.csv').expect(200);
    expect(csv.text).toContain('"kojo@example.com"');
    expect(csv.text.split('\r\n')[0]).toContain('Marketing consent');
  });

  it('neutralises spreadsheet formulas in CSV exports', async () => {
    await request(app)
      .post('/api/orders')
      .send(orderBody({ name: '=HYPERLINK("x")' }))
      .expect(201);
    const a = await login();
    const csv = await a.get('/api/admin/customers/export.csv').expect(200);
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('campaigns', () => {
  const msg = {
    subject: 'New: Jollof Fridays',
    heading: 'Jollof is here',
    body: 'Hello!\n\nTry it **now**.',
    imageUrl: '',
    ctaLabel: 'Order',
    ctaUrl: 'http://localhost:5173/#menu',
  };

  it('sends marketing only to opted-in customers, with unsubscribe link + headers', async () => {
    await seedOrders();
    const a = await login();
    const preview = await a
      .post('/api/admin/campaigns/preview')
      .send({ ...msg, segment: 'all_opted_in' })
      .expect(200);
    expect(preview.body.recipientCount).toBe(1);
    expect(preview.body.html).toContain('/unsubscribe?token=');
    expect(preview.body.html).toContain('Hollywood Street');

    const sent = await a
      .post('/api/admin/campaigns/send')
      .send({ ...msg, segment: 'all_opted_in' })
      .expect(201);
    expect(sent.body.campaign).toMatchObject({
      recipientCount: 1,
      sentCount: 1,
      status: 'sent',
      isTransactional: false,
    });
    const logs = await EmailLogModel.find({ type: 'marketing' }).lean();
    expect(logs.map((l) => l.to)).toEqual(['ama@example.com']);
    expect(logs[0].html).toContain('<strong>now</strong>');

    // "selected" also respects consent
    const ids = (await CustomerModel.find().lean()).map((c) => String(c._id));
    const sel = await a
      .post('/api/admin/campaigns/preview')
      .send({ ...msg, segment: 'selected', customerIds: ids })
      .expect(200);
    expect(sel.body.recipientCount).toBe(1);
  });

  it('allows a one-to-one message to a customer who did not opt in', async () => {
    await seedOrders();
    const a = await login();
    const kojo = await CustomerModel.findOne({ email: 'kojo@example.com' }).lean();
    const res = await a
      .post('/api/admin/campaigns/send')
      .send({ ...msg, segment: 'single', customerIds: [String(kojo!._id)] })
      .expect(201);
    expect(res.body.campaign).toMatchObject({ recipientCount: 1, isTransactional: true });
    const log = await EmailLogModel.findOne({ type: 'direct' }).lean();
    expect(log?.to).toBe('kojo@example.com');
    expect(log?.html).not.toContain('/unsubscribe?token=');
  });

  it('respects unsubscribes and refuses empty audiences', async () => {
    await seedOrders();
    const ama = await CustomerModel.findOne({ email: 'ama@example.com' }).lean();
    await request(app)
      .post(`/api/unsubscribe/one-click?token=${ama!.unsubscribeToken}`)
      .expect(200);
    const a = await login();
    const res = await a
      .post('/api/admin/campaigns/send')
      .send({ ...msg, segment: 'all_opted_in' })
      .expect(400);
    expect(res.body.code).toBe('EMPTY_AUDIENCE');
  });

  it('sends a test to the owner', async () => {
    const a = await login();
    const res = await a
      .post('/api/admin/campaigns/test')
      .send({ ...msg, segment: 'all_opted_in' })
      .expect(200);
    expect(res.body.to).toBe('owner@233kitchen.test');
    expect(
      await EmailLogModel.countDocuments({ type: 'test', subject: '[TEST] New: Jollof Fridays' }),
    ).toBe(1);
  });
});

describe('menu management', () => {
  it('price edits apply to new orders and sold-out toggles block ordering', async () => {
    const a = await login();
    const menu = (await a.get('/api/admin/menu').expect(200)).body.items;
    const rice = menu.find((m: { slug: string }) => m.slug === 'loaded-fried-rice-chicken');
    await a
      .put(`/api/admin/menu/${rice.id}`)
      .send({ ...rice, id: undefined, basePrice: 2200 })
      .expect(200);
    const o = await request(app)
      .post('/api/orders')
      .send(
        orderBody({ items: [{ slug: 'loaded-fried-rice-chicken', quantity: 1, selections: [] }] }),
      )
      .expect(201);
    expect(o.body.order.total).toBe(2200);

    await a
      .patch(`/api/admin/menu/${rice.id}/availability`)
      .send({ isAvailable: false, groupKey: 'extras', optionKey: 'extra-chicken' })
      .expect(200);
    const blocked = await request(app)
      .post('/api/orders')
      .send(
        orderBody({
          items: [
            {
              slug: 'loaded-fried-rice-chicken',
              quantity: 1,
              selections: [{ groupKey: 'extras', optionKey: 'extra-chicken', qty: 1 }],
            },
          ],
        }),
      )
      .expect(422);
    expect(blocked.body.code).toBe('OPTION_UNAVAILABLE');
    const pub = (await request(app).get('/api/menu').expect(200)).body.items.find(
      (m: { slug: string }) => m.slug === 'loaded-fried-rice-chicken',
    );
    expect(
      pub.optionGroups[0].options.find((x: { key: string }) => x.key === 'extra-chicken')
        .isAvailable,
    ).toBe(false);
  });

  it('validates menu input and creates/deletes items', async () => {
    const a = await login();
    await a.post('/api/admin/menu').send({ name: 'X' }).expect(400);
    const item = {
      name: 'Kelewele',
      slug: 'kelewele',
      description: 'Spicy fried plantain',
      category: 'mains',
      basePrice: 800,
      image: null,
      isAvailable: true,
      sortOrder: 5,
      optionGroups: [],
    };
    const created = await a.post('/api/admin/menu').send(item).expect(201);
    await a.post('/api/admin/menu').send(item).expect(409);
    await a.delete(`/api/admin/menu/${created.body.item.id}`).expect(200);
  });
});

describe('settings', () => {
  it('saves settings, validates them and drives public config', async () => {
    const a = await login();
    const { settings } = (await a.get('/api/admin/settings').expect(200)).body;
    await a
      .put('/api/admin/settings')
      .send({ ...settings, cutoffTime: '25:99' })
      .expect(400);
    await a
      .put('/api/admin/settings')
      .send({ ...settings, windows: [] })
      .expect(400);
    const saved = await a
      .put('/api/admin/settings')
      .send({ ...settings, orderingPaused: true, pausedMessage: 'Back next week!' })
      .expect(200);
    expect(saved.body.settings.orderingPaused).toBe(true);
    const cfg = await request(app).get('/api/config').expect(200);
    expect(cfg.body.settings.pausedMessage).toBe('Back next week!');
    expect(cfg.body.pickupDates).toEqual([]);
    expect(cfg.body.settings.notificationEmails).toBeUndefined();
    expect(cfg.body.settings.pickupAddressFull).toBeUndefined();
  });
});
