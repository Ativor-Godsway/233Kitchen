import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { CustomerModel } from '../server/models/Customer.js';
import { nextOpenDate, orderBody, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(disconnectDb);

async function login() {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }).expect(200);
  return agent;
}

describe('admin auth', () => {
  it('protects admin routes', async () => {
    await request(app).get('/api/admin/orders').expect(401);
    expect((await request(app).get('/api/admin/me').expect(200)).body.admin).toBeNull();
  });

  it('rejects wrong passwords and accepts the seeded admin with an httpOnly cookie', async () => {
    await request(app).post('/api/admin/login').send({ email: process.env.ADMIN_EMAIL, password: 'wrong' }).expect(401);
    const res = await request(app).post('/api/admin/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/k233_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('changing the password revokes other sessions', async () => {
    const a = await login();
    const b = await login();
    await a.post('/api/admin/password').send({ currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'a-much-better-password' }).expect(200);
    expect((await a.get('/api/admin/me').expect(200)).body.admin).toBeTruthy();
    expect((await b.get('/api/admin/me').expect(200)).body.admin).toBeNull();
    await b.get('/api/admin/orders').expect(401);
    // restore for later tests (resetDb re-seeds but keeps an existing admin)
    await a.post('/api/admin/password').send({ currentPassword: 'a-much-better-password', newPassword: process.env.ADMIN_PASSWORD }).expect(200);
  });

  it('logs out', async () => {
    const a = await login();
    await a.post('/api/admin/logout').expect(200);
    expect((await a.get('/api/admin/me').expect(200)).body.admin).toBeNull();
    await a.get('/api/admin/orders').expect(401);
  });
});

describe('admin orders', () => {
  it('lists, searches and filters orders', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    await request(app).post('/api/orders').send(orderBody({ name: 'Kwame Nkrumah', email: 'kwame@example.com', phone: '617-555-0100' })).expect(201);
    const a = await login();
    const all = await a.get('/api/admin/orders?status=all').expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.statusCounts.new).toBe(2);
    expect((await a.get('/api/admin/orders?q=kwame').expect(200)).body.total).toBe(1);
    expect((await a.get('/api/admin/orders?q=6175550100').expect(200)).body.total).toBe(1);
    expect((await a.get('/api/admin/orders?q=233-0001').expect(200)).body.items[0].customer.name).toBe('Ama Mensah');
    expect((await a.get('/api/admin/orders?q=(.*)').expect(200)).body.total).toBe(0);
  });

  it('updates status with history + customer email, and payment status', async () => {
    const created = await request(app).post('/api/orders').send(orderBody()).expect(201);
    const a = await login();
    const list = await a.get('/api/admin/orders').expect(200);
    const id = list.body.items[0].id;

    const res = await a.patch(`/api/admin/orders/${id}`).send({ status: 'confirmed', statusNote: 'See you Wednesday!' }).expect(200);
    expect(res.body.order.status).toBe('confirmed');
    expect(res.body.email.ok).toBe(true);
    const hist = res.body.order.statusHistory;
    expect(hist.at(-1)).toMatchObject({ status: 'confirmed', by: process.env.ADMIN_EMAIL, notified: true, note: 'See you Wednesday!' });
    const mail = await EmailLogModel.findOne({ type: 'customer_status_update' }).lean();
    expect(mail?.subject).toBe(`Your order is confirmed — ${created.body.order.number}`);
    expect(mail?.html).toContain('See you Wednesday!');

    // "preparing" is not in notifyOnStatus by default → no email
    const prep = await a.patch(`/api/admin/orders/${id}`).send({ status: 'preparing' }).expect(200);
    expect(prep.body.email).toBeNull();
    // explicit opt-out
    const ready = await a.patch(`/api/admin/orders/${id}`).send({ status: 'ready', notifyCustomer: false }).expect(200);
    expect(ready.body.email).toBeNull();
    expect(await EmailLogModel.countDocuments({ type: 'customer_status_update' })).toBe(1);

    const paid = await a.patch(`/api/admin/orders/${id}`).send({ paymentStatus: 'paid_zelle', internalNotes: 'Paid Tue' }).expect(200);
    expect(paid.body.order.paymentStatus).toBe('paid_zelle');
    expect(paid.body.order.internalNotes).toBe('Paid Tue');

    await a.patch(`/api/admin/orders/${id}`).send({ status: 'shipped' }).expect(400);
    await a.patch(`/api/admin/orders/${id}`).send({ total: 1 }).expect(400);
  });

  it('cancelling an order updates customer stats', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const a = await login();
    const id = (await a.get('/api/admin/orders').expect(200)).body.items[0].id;
    await a.patch(`/api/admin/orders/${id}`).send({ status: 'cancelled' }).expect(200);
    const c = await CustomerModel.findOne({ email: 'ama@example.com' }).lean();
    expect(c?.orderCount).toBe(0);
    expect(c?.totalSpent).toBe(0);
  });

  it('reports orders created since the last poll', async () => {
    const a = await login();
    const first = await a.get('/api/admin/orders/latest').expect(200);
    expect(first.body.orders).toEqual([]);
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const next = await a.get(`/api/admin/orders/latest?since=${encodeURIComponent(first.body.now)}`).expect(200);
    expect(next.body.orders).toHaveLength(1);
    expect(next.body.newCount).toBe(1);
  });

  it('builds an aggregated prep sheet and CSV', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201); // 2× rice (+1 plantain each), 1× kenkey oreo+nuts
    await request(app)
      .post('/api/orders')
      .send(
        orderBody({
          pickupWindowId: 'w16',
          items: [
            { slug: 'ice-kenkey', quantity: 2, selections: [{ groupKey: 'flavour', optionKey: 'caramel', qty: 1 }] },
            { slug: 'loaded-fried-rice-chicken', quantity: 1, selections: [{ groupKey: 'extras', optionKey: 'extra-plantain', qty: 2 }] },
          ],
        }),
      )
      .expect(201);
    const a = await login();
    const date = nextOpenDate();
    const sheet = (await a.get(`/api/admin/orders/prep-sheet?date=${date}`).expect(200)).body;
    expect(sheet.orderCount).toBe(2);
    const rice = sheet.items.find((i: { slug: string }) => i.slug === 'loaded-fried-rice-chicken');
    expect(rice.quantity).toBe(3);
    expect(rice.options).toEqual([{ group: 'Extras', name: 'Extra plantain', count: 4 }]);
    const kenkey = sheet.items.find((i: { slug: string }) => i.slug === 'ice-kenkey');
    expect(kenkey.quantity).toBe(3);
    const counts = Object.fromEntries(kenkey.options.map((o: { name: string; count: number }) => [o.name, o.count]));
    expect(counts).toEqual({ Caramel: 2, 'Oreo Delight': 1, 'With nuts': 1 });
    expect(sheet.windows.find((w: { id: string }) => w.id === 'w16').count).toBe(1);

    const csv = await a.get(`/api/admin/orders/prep-sheet.csv?date=${date}`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('"233-0001"');
    expect(csv.text).toContain('TOTALS');
  });
});

describe('email log', () => {
  it('lists failures and resends them', async () => {
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    await EmailLogModel.updateMany({}, { $set: { status: 'failed', error: 'Provider down' } });
    const a = await login();
    const list = await a.get('/api/admin/emails?status=failed').expect(200);
    expect(list.body.failedCount).toBe(2);
    const res = await a.post(`/api/admin/emails/${list.body.items[0].id}/resend`).expect(200);
    expect(res.body.email.status).toBe('sent_dev');
    expect((await a.get('/api/admin/emails?status=failed').expect(200)).body.failedCount).toBe(1);
  });
});
