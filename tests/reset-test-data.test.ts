import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { resetTestData } from '../server/services/resetTestData.js';
import { OrderModel } from '../server/models/Order.js';
import { CustomerModel } from '../server/models/Customer.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { CampaignModel } from '../server/models/Campaign.js';
import { RateLimitModel } from '../server/models/RateLimit.js';
import { MenuItemModel } from '../server/models/MenuItem.js';
import { SettingsModel } from '../server/models/Settings.js';
import { AdminUserModel } from '../server/models/AdminUser.js';
import { orderBody, resetDb } from './helpers.js';

const roots: string[] = [];
const tmpRoot = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'k233-reset-'));
  roots.push(d);
  return d;
};

beforeEach(async () => {
  await resetDb();
  await RateLimitModel.deleteMany({});
  await request(app).post('/api/orders').send(orderBody()).expect(201);
  await request(app)
    .post('/api/orders')
    .send(orderBody({ name: 'Kofi Boateng', email: 'kofi@example.org', phone: '617-555-0100' }))
    .expect(201);
  await CampaignModel.create({ subject: 'Hi', body: 'Hello', segment: 'all_opted_in' });
  await RateLimitModel.create({
    _id: 'order:1.2.3.4',
    hits: 3,
    expiresAt: new Date(Date.now() + 6e5),
  });
});
afterAll(async () => {
  for (const d of roots) rmSync(d, { recursive: true, force: true });
  await disconnectDb();
});

async function snapshotKept() {
  return {
    menu: await MenuItemModel.countDocuments(),
    settings: await SettingsModel.countDocuments(),
    admins: await AdminUserModel.countDocuments(),
  };
}

describe('prod:reset-test-data', () => {
  it('dry run reports counts and changes nothing', async () => {
    const confirm = vi.fn();
    const backupRoot = tmpRoot();
    const r = await resetTestData({ dryRun: true, confirm, backupRoot });
    expect(r.status).toBe('dry-run');
    expect(r.dbName).toBe(mongoose.connection.name);
    expect(r.counts).toMatchObject({
      orders: 2,
      customers: 2,
      emaillogs: 4,
      campaigns: 1,
      ratelimits: 1,
      'counters (order sequence)': 1,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(readdirSync(backupRoot)).toEqual([]);
    expect(await OrderModel.countDocuments()).toBe(2);
  });

  it('does nothing when the confirmation is refused', async () => {
    const backupRoot = tmpRoot();
    const r = await resetTestData({ confirm: async () => false, backupRoot });
    expect(r.status).toBe('cancelled');
    expect(readdirSync(backupRoot)).toEqual([]);
    expect(await OrderModel.countDocuments()).toBe(2);
    expect(await CustomerModel.countDocuments()).toBe(2);
  });

  it('shows host and database name in the confirmation, backs up, deletes and resets numbering', async () => {
    const kept = await snapshotKept();
    const backupRoot = tmpRoot();
    const confirm = vi.fn(async () => true);
    const r = await resetTestData({
      confirm,
      backupRoot,
      now: new Date('2026-10-09T12:00:00Z'),
    });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      }),
    );
    expect(r.status).toBe('done');
    expect(r.deleted).toEqual({
      orders: 2,
      customers: 2,
      emaillogs: 4,
      campaigns: 1,
      ratelimits: 1,
    });

    // Backup: one Extended JSON file per collection, with every deleted document.
    expect(r.backupDir).toBe(path.join(backupRoot, '2026-10-09T12-00-00-000Z'));
    const files = readdirSync(r.backupDir!).sort();
    expect(files).toEqual([
      'README.txt',
      'campaigns.json',
      'counters.json',
      'customers.json',
      'emaillogs.json',
      'orders.json',
      'ratelimits.json',
    ]);
    const { EJSON } = mongoose.mongo.BSON;
    const orders = EJSON.parse(readFileSync(path.join(r.backupDir!, 'orders.json'), 'utf8'));
    expect(orders.map((o: { number: string }) => o.number).sort()).toEqual([
      '233-0001',
      '233-0002',
    ]);
    expect(orders[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(orders[0].createdAt).toBeInstanceOf(Date);

    for (const m of [OrderModel, CustomerModel, EmailLogModel, CampaignModel, RateLimitModel])
      expect(await (m as mongoose.Model<unknown>).countDocuments()).toBe(0);
    expect(await snapshotKept()).toEqual(kept);

    // Next order starts again at 233-0001.
    expect(r.nextOrderSeq).toBe(1);
    const next = await request(app).post('/api/orders').send(orderBody()).expect(201);
    expect(next.body.order.number).toBe('233-0001');
  });
});
