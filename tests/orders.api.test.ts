import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { OrderModel } from '../server/models/Order.js';
import { CustomerModel } from '../server/models/Customer.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { formatOrderNumber } from '../server/models/Counter.js';
import { createOrder } from '../server/services/orderService.js';
import { orderToken } from '../server/services/orderToken.js';
import { HttpError } from '../server/middleware/errors.js';
import { nextOpenDate, orderBody, patchSettings, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(disconnectDb);

describe('POST /api/orders — happy path', () => {
  it('creates an order, re-prices on the server, upserts the customer and logs emails', async () => {
    const res = await request(app).post('/api/orders').send(orderBody()).expect(201);
    // 2 × ($20 + $3 plantain) + $5 kenkey (nuts free) = $51
    expect(res.body.order.number).toBe('233-0001');
    expect(res.body.order.total).toBe(5100);
    expect(res.body.order.email).toBe('ama@example.com');
    expect(typeof res.body.token).toBe('string');

    const saved = await OrderModel.findOne({ number: '233-0001' }).lean();
    expect(saved).toBeTruthy();
    expect(saved!.customer.phone).toBe('(508) 555-0123');
    expect(saved!.status).toBe('new');
    expect(saved!.paymentStatus).toBe('unpaid');
    expect(saved!.items[0].lineTotal).toBe(4600);

    const customer = await CustomerModel.findOne({ email: 'ama@example.com' }).lean();
    expect(customer?.orderCount).toBe(1);
    expect(customer?.totalSpent).toBe(5100);
    expect(customer?.marketingConsent).toBe(true);

    const logs = await EmailLogModel.find({ orderNumber: '233-0001' }).lean();
    expect(logs.map((l) => l.type).sort()).toEqual(['customer_order_received', 'owner_new_order']);
    expect(logs.every((l) => l.status === 'sent_dev')).toBe(true);
    const owner = logs.find((l) => l.type === 'owner_new_order')!;
    expect(owner.to).toBe('owner@233kitchen.test');
    expect(owner.subject).toMatch(/^🧾 New order 233-0001 — \$51 — \w{3}, \w{3} \d+, 2–4 PM$/);
  });

  it('increments order numbers and merges repeat customers', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const second = await request(app)
      .post('/api/orders')
      .send(orderBody({ marketingConsent: false }))
      .expect(201);
    expect(second.body.order.number).toBe('233-0002');
    const customers = await CustomerModel.find().lean();
    expect(customers).toHaveLength(1);
    expect(customers[0].orderCount).toBe(2);
    // An unticked box on a later order does not revoke earlier consent.
    expect(customers[0].marketingConsent).toBe(true);
  });

  it('formats order numbers', () => {
    expect(formatOrderNumber(1)).toBe('233-0001');
    expect(formatOrderNumber(12)).toBe('233-0012');
    expect(formatOrderNumber(12345)).toBe('233-12345');
  });

  it('ignores prices sent by the client', async () => {
    const body = orderBody({
      total: 1,
      items: [
        {
          slug: 'banku-grilled-tilapia',
          quantity: 1,
          price: 1,
          lineTotal: 1,
          selections: [{ groupKey: 'extras', optionKey: 'extra-tilapia', qty: 1, unitPrice: 0 }],
        },
      ],
    });
    const res = await request(app).post('/api/orders').send(body).expect(201);
    expect(res.body.order.total).toBe(4000);
  });

  it('lets the customer view the order and download an .ics with the signed token only', async () => {
    const res = await request(app).post('/api/orders').send(orderBody()).expect(201);
    const { number } = res.body.order;
    const view = await request(app).get(`/api/orders/${number}?t=${res.body.token}`).expect(200);
    expect(view.body.order.number).toBe(number);
    expect(view.body.order.paymentInstructions).toMatch(/Zelle/);
    await request(app).get(`/api/orders/${number}?t=wrong-token-wrong-token-wrong-tok`).expect(404);
    await request(app).get(`/api/orders/${number}`).expect(404);
    const ics = await request(app)
      .get(`/api/orders/${number}/ics?t=${orderToken(number)}`)
      .expect(200);
    expect(ics.headers['content-type']).toMatch(/text\/calendar/);
    expect(ics.text).toContain('BEGIN:VEVENT');
    expect(ics.text).toContain(`${number}@233kitchen`);
  });
});

describe('POST /api/orders — validation', () => {
  it('returns field errors for bad customer details', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ name: '', phone: '123', email: 'nope' }))
      .expect(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(['email', 'name', 'phone']);
  });

  it('rejects an empty bag', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ items: [] }))
      .expect(400);
    expect(res.body.fieldErrors.items).toBeTruthy();
  });

  it('rejects Ice Kenkey without a flavour', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ items: [{ slug: 'ice-kenkey', quantity: 1, selections: [] }] }))
      .expect(422);
    expect(res.body.code).toBe('REQUIRED_OPTION');
  });

  it('rejects unknown items and sold-out items', async () => {
    await request(app)
      .post('/api/orders')
      .send(orderBody({ items: [{ slug: 'pizza', quantity: 1, selections: [] }] }))
      .expect(422);
    const { MenuItemModel } = await import('../server/models/MenuItem.js');
    await MenuItemModel.updateOne(
      { slug: 'banku-grilled-tilapia' },
      { $set: { isAvailable: false } },
    );
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ items: [{ slug: 'banku-grilled-tilapia', quantity: 1, selections: [] }] }))
      .expect(422);
    expect(res.body.code).toBe('ITEM_UNAVAILABLE');
  });

  it('rejects an invalid pickup window', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ pickupWindowId: 'w99' }))
      .expect(400);
    expect(res.body.code).toBe('INVALID_WINDOW');
  });

  it('blocks honeypot submissions', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ website: 'http://spam.example' }))
      .expect(400);
    expect(res.body.code).toBe('SPAM');
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it('strips Mongo operators from input', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody({ email: { $gt: '' } }))
      .expect(400);
    expect(res.body.fieldErrors.email).toBeTruthy();
  });
});

describe('cutoff, pause and capacity', () => {
  it('refuses a date whose cutoff has passed', async () => {
    // Wed Oct 14 2026 closes Mon Oct 12 23:59:59 EDT (= Oct 13 03:59:59Z)
    const body = orderBody({ pickupDate: '2026-10-14' });
    await expect(createOrder(body, new Date('2026-10-13T03:59:30Z'))).resolves.toBeTruthy();
    await expect(createOrder(body, new Date('2026-10-13T04:00:30Z'))).rejects.toMatchObject({
      code: 'CUTOFF_PASSED',
      status: 409,
    });
  });

  it('refuses non-pickup days', async () => {
    await expect(
      createOrder(orderBody({ pickupDate: '2026-10-15' }), new Date('2026-10-06T12:00:00Z')),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('refuses orders while paused', async () => {
    await patchSettings({ orderingPaused: true });
    const res = await request(app).post('/api/orders').send(orderBody()).expect(409);
    expect(res.body.code).toBe('ORDERING_PAUSED');
  });

  it('enforces window capacity and frees space when an order is cancelled', async () => {
    const { DEFAULT_SETTINGS } = await import('../shared/constants.js');
    await patchSettings({
      windows: DEFAULT_SETTINGS.windows.map((w) => (w.id === 'w14' ? { ...w, capacity: 2 } : w)),
    });
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const full = await request(app).post('/api/orders').send(orderBody()).expect(409);
    expect(full.body.code).toBe('SLOT_FULL');
    // Other windows still open
    await request(app)
      .post('/api/orders')
      .send(orderBody({ pickupWindowId: 'w16' }))
      .expect(201);

    const config = await request(app).get('/api/config').expect(200);
    const date = config.body.pickupDates.find((d: { date: string }) => d.date === nextOpenDate());
    expect(date.windows.find((w: { id: string }) => w.id === 'w14')).toMatchObject({
      remaining: 0,
      isFull: true,
    });

    await OrderModel.updateOne({ number: '233-0001' }, { $set: { status: 'cancelled' } });
    await request(app).post('/api/orders').send(orderBody()).expect(201);
  });
});

describe('emails never block orders', () => {
  it('saves the order and logs a failure when the provider errors', async () => {
    const prev = process.env.VERCEL;
    // Simulate production with no email provider configured.
    process.env.VERCEL = '1';
    process.env.JWT_SECRET = 'test-secret';
    process.env.MONGODB_URI = 'unused-because-already-connected';
    const { env } = await import('../server/env.js');
    const isProd = Object.getOwnPropertyDescriptor(env, 'isProd');
    Object.defineProperty(env, 'isProd', { value: true, configurable: true });
    try {
      const res = await request(app).post('/api/orders').send(orderBody()).expect(201);
      const logs = await EmailLogModel.find({ orderNumber: res.body.order.number }).lean();
      expect(logs.length).toBe(2);
      expect(logs.every((l) => l.status === 'failed' && /not configured/.test(l.error ?? ''))).toBe(
        true,
      );
    } finally {
      if (isProd) Object.defineProperty(env, 'isProd', isProd);
      process.env.MONGODB_URI = '';
      if (prev === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prev;
    }
  });
});

describe('unsubscribe', () => {
  it('turns off marketing consent with the customer token', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const c = await CustomerModel.findOne({ email: 'ama@example.com' }).lean();
    await request(app).post('/api/unsubscribe').send({ token: c!.unsubscribeToken }).expect(200);
    const after = await CustomerModel.findById(c!._id).lean();
    expect(after?.marketingConsent).toBe(false);
    expect(after?.unsubscribedAt).toBeTruthy();
    await request(app).post('/api/unsubscribe').send({ token: 'not-a-real-token-123' }).expect(404);
  });
});
