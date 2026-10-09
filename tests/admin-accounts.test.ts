import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { AdminUserModel } from '../server/models/AdminUser.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { listAdmins, removeAdmin, setAdmin } from '../server/services/adminUsers.js';
import { resetDb } from './helpers.js';

const OWNER = { email: 'owner@233kitchen.test', password: 'owner-password-1' };

beforeEach(async () => {
  await resetDb();
  await AdminUserModel.deleteMany({ email: { $ne: process.env.ADMIN_EMAIL } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  // Leave the seeded admin with its original password for other test files.
  await setAdmin(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await disconnectDb();
});

async function login(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email, password }).expect(200);
  return agent;
}

describe('admin:set', () => {
  it('creates a second admin; both can log in', async () => {
    const r = await setAdmin('Owner@233Kitchen.test', OWNER.password);
    expect(r).toEqual({ email: OWNER.email, created: true });
    await login(OWNER.email, OWNER.password);
    await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
    expect((await listAdmins()).map((a) => a.email).sort()).toEqual(
      [OWNER.email, process.env.ADMIN_EMAIL].sort(),
    );
  });

  it('changing a password signs out existing sessions and the old password stops working', async () => {
    await setAdmin(OWNER.email, OWNER.password);
    const a = await login(OWNER.email, OWNER.password);
    expect((await a.get('/api/admin/me').expect(200)).body.admin.email).toBe(OWNER.email);

    const r = await setAdmin(OWNER.email, 'a-brand-new-password');
    expect(r.created).toBe(false);
    expect((await a.get('/api/admin/me').expect(200)).body.admin).toBeNull();
    await a.get('/api/admin/orders').expect(401);
    await request(app)
      .post('/api/admin/login')
      .send({ email: OWNER.email, password: OWNER.password })
      .expect(401);
    await login(OWNER.email, 'a-brand-new-password');
  });

  it('enforces a minimum length and a valid email', async () => {
    await expect(setAdmin(OWNER.email, 'short')).rejects.toThrow(/at least 10/);
    await expect(setAdmin('not-an-email', OWNER.password)).rejects.toThrow(/valid email/);
  });

  it('stores only a bcrypt hash', async () => {
    await setAdmin(OWNER.email, OWNER.password);
    const row = await AdminUserModel.findOne({ email: OWNER.email }).lean();
    expect(row?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(JSON.stringify(row)).not.toContain(OWNER.password);
  });
});

describe('admin:remove', () => {
  it('removes an admin but never the last one', async () => {
    await setAdmin(OWNER.email, OWNER.password);
    await removeAdmin(OWNER.email);
    await expect(removeAdmin(process.env.ADMIN_EMAIL!)).rejects.toThrow(/only admin/);
    expect(await AdminUserModel.countDocuments()).toBe(1);
  });
});

describe('Settings → Send test email', () => {
  it('sends to the logged-in admin by default', async () => {
    await setAdmin(OWNER.email, OWNER.password);
    const a = await login(OWNER.email, OWNER.password);
    const res = await a.post('/api/admin/settings/test-email').send({}).expect(200);
    expect(res.body.results).toEqual([
      { to: OWNER.email, ok: true, status: 'sent_dev', error: null },
    ]);
    const log = await EmailLogModel.findOne({ type: 'test' }).lean();
    expect(log?.to).toBe(OWNER.email);
  });

  it('can test every new-order inbox instead', async () => {
    const a = await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
    const res = await a
      .post('/api/admin/settings/test-email')
      .send({ target: 'notifications' })
      .expect(200);
    expect(res.body.results.map((r: { to: string }) => r.to)).toEqual([process.env.OWNER_EMAIL]);
    await a.post('/api/admin/settings/test-email').send({ target: 'everyone' }).expect(400);
  });
});
