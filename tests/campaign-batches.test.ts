import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { CustomerModel } from '../server/models/Customer.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { CampaignModel } from '../server/models/Campaign.js';
import { resetDb } from './helpers.js';

const KEYS = ['EMAIL_BATCH_SIZE', 'EMAIL_BATCH_DELAY_MS', 'EMAIL_DAILY_LIMIT'] as const;
const saved: Record<string, string | undefined> = {};

const msg = {
  subject: 'New this week',
  heading: '',
  body: 'Hello!',
  imageUrl: '',
  ctaLabel: '',
  ctaUrl: '',
  segment: 'all_opted_in',
};

beforeEach(async () => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.EMAIL_BATCH_SIZE = '3';
  process.env.EMAIL_BATCH_DELAY_MS = '0';
  await resetDb();
  await CustomerModel.insertMany(
    Array.from({ length: 8 }, (_, i) => ({
      name: `Customer ${i}`,
      email: `c${i}@example.org`,
      marketingConsent: true,
      lastOrderAt: new Date(Date.now() - i * 60_000),
    })),
  );
});
afterEach(() => {
  for (const k of KEYS) process.env[k] = saved[k];
});
afterAll(disconnectDb);

async function login() {
  const agent = request.agent(app);
  await agent
    .post('/api/admin/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .expect(200);
  return agent;
}

describe('batched marketing sends', () => {
  it('sends one batch per request until done', async () => {
    process.env.EMAIL_DAILY_LIMIT = '0';
    const a = await login();
    const first = await a.post('/api/admin/campaigns/send').send(msg).expect(201);
    expect(first.body.campaign).toMatchObject({
      status: 'sending',
      recipientCount: 8,
      sentCount: 3,
      pendingCount: 5,
    });
    const id = first.body.campaign.id;
    const second = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(second.body.campaign).toMatchObject({ status: 'sending', sentCount: 6 });
    const third = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(third.body.campaign).toMatchObject({ status: 'sent', sentCount: 8, pendingCount: 0 });
    // Continuing a finished campaign changes nothing.
    const again = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(again.body.campaign.sentCount).toBe(8);
    const logs = await EmailLogModel.find({ type: 'marketing' }).lean();
    expect(new Set(logs.map((l) => l.to)).size).toBe(8);
  });

  it('pauses at the daily limit, then resumes without double-sending or emailing unsubscribers', async () => {
    process.env.EMAIL_DAILY_LIMIT = '5';
    const a = await login();
    const preview = await a.post('/api/admin/campaigns/preview').send(msg).expect(200);
    expect(preview.body.quota).toMatchObject({ limit: 5, sentLast24h: 0, remaining: 5 });

    const first = await a.post('/api/admin/campaigns/send').send(msg).expect(201);
    const id = first.body.campaign.id;
    const second = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(second.body.campaign).toMatchObject({ status: 'paused', sentCount: 5, pendingCount: 3 });
    expect(second.body.quota.remaining).toBe(0);
    const stuck = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(stuck.body.campaign).toMatchObject({ status: 'paused', sentCount: 5 });

    // Next day: yesterday's sends fall out of the 24h window. One pending customer unsubscribed.
    await EmailLogModel.collection.updateMany(
      {},
      { $set: { createdAt: new Date(Date.now() - 25 * 3600e3) } },
    );
    const pending = (await CampaignModel.findById(id).lean())!.recipientIds.slice(5);
    await CustomerModel.updateOne({ _id: pending[0] }, { $set: { unsubscribedAt: new Date() } });

    const resumed = await a.post(`/api/admin/campaigns/${id}/continue`).expect(200);
    expect(resumed.body.campaign).toMatchObject({
      status: 'sent',
      sentCount: 7,
      skippedCount: 1,
      pendingCount: 0,
    });
    const logs = await EmailLogModel.find({ type: 'marketing' }).lean();
    expect(logs).toHaveLength(7);
    expect(new Set(logs.map((l) => l.to)).size).toBe(7);
  });

  it('does not let two tabs send the same batch', async () => {
    process.env.EMAIL_DAILY_LIMIT = '0';
    const a = await login();
    const first = await a.post('/api/admin/campaigns/send').send(msg).expect(201);
    const id = first.body.campaign.id;
    await CampaignModel.updateOne(
      { _id: id },
      { $set: { lockedUntil: new Date(Date.now() + 6e4) } },
    );
    const busy = await a.post(`/api/admin/campaigns/${id}/continue`).expect(409);
    expect(busy.body.code).toBe('BUSY');
  });
});
