import { Types } from 'mongoose';
import { CustomerModel, type CustomerRow } from '../models/Customer.js';
import { CampaignModel, toCampaignDTO, type CampaignRow } from '../models/Campaign.js';
import { EmailLogModel } from '../models/EmailLog.js';
import { messageEmail, unsubscribeUrl } from '../emails/templates.js';
import { providerStatus, sendEmail } from './emailService.js';
import { env } from '../env.js';
import type { CampaignInput } from '../../shared/schemas.js';
import type { EmailQuota, Settings } from '../../shared/types.js';
import { HttpError } from '../middleware/errors.js';

const DAY = 24 * 60 * 60 * 1000;

/** Only opted-in, never-unsubscribed customers may receive marketing. */
const eligible = { marketingConsent: true, unsubscribedAt: null };

/**
 * Resolves recipients. "single" is a one-to-one (transactional) message and
 * ignores marketing consent; every other segment is marketing and is filtered
 * to opted-in customers.
 */
export async function resolveAudience(
  input: Pick<CampaignInput, 'segment' | 'tag' | 'customerIds'>,
  now = new Date(),
) {
  const ids = input.customerIds.map((id) => new Types.ObjectId(id));
  let filter: Record<string, unknown>;
  switch (input.segment) {
    case 'single':
      if (ids.length !== 1) throw new HttpError(400, 'Choose exactly one customer', 'VALIDATION');
      return {
        transactional: true,
        customers: await CustomerModel.find({ _id: ids[0] }).lean<CustomerRow[]>(),
      };
    case 'selected':
      filter = { ...eligible, _id: { $in: ids } };
      break;
    case 'ordered_last_30':
      filter = { ...eligible, lastOrderAt: { $gte: new Date(now.getTime() - 30 * DAY) } };
      break;
    case 'lapsed_60':
      filter = { ...eligible, lastOrderAt: { $lt: new Date(now.getTime() - 60 * DAY) } };
      break;
    case 'tag':
      if (!input.tag) throw new HttpError(400, 'Choose a tag', 'VALIDATION');
      filter = { ...eligible, tags: input.tag.toLowerCase() };
      break;
    default:
      filter = { ...eligible };
  }
  return {
    transactional: false,
    customers: await CustomerModel.find(filter).sort({ lastOrderAt: -1 }).lean<CustomerRow[]>(),
  };
}

export function renderFor(
  input: CampaignInput,
  s: Settings,
  c: Pick<CustomerRow, 'name' | 'unsubscribeToken'> | null,
  transactional: boolean,
) {
  return messageEmail(input, s, {
    firstName: c?.name.split(' ')[0],
    unsubscribeToken: c?.unsubscribeToken,
    marketing: !transactional,
  });
}

export async function sendTest(input: CampaignInput, s: Settings, to: string) {
  // No real customer behind a test send: no greeting, and the generic unsubscribe page.
  const content = renderFor(input, s, null, input.segment === 'single');
  return sendEmail({ type: 'test', to, ...content, subject: `[TEST] ${content.subject}` });
}

/** How many more emails may go out today under EMAIL_DAILY_LIMIT (Gmail: ~500/day). */
export async function emailQuota(now = new Date()): Promise<EmailQuota> {
  const limit = env.email.dailyLimit;
  const sentLast24h = await EmailLogModel.countDocuments({
    status: { $in: ['sent', 'sent_dev'] },
    createdAt: { $gte: new Date(now.getTime() - DAY) },
  });
  return {
    limit,
    sentLast24h,
    remaining: limit ? Math.max(0, limit - sentLast24h) : null,
    batchSize: env.email.batchSize,
    provider: providerStatus().label,
  };
}

/**
 * Creates a campaign for the audience and sends its first batch. Large audiences continue with
 * sendNextBatch (one batch per request, so each stays well inside the serverless time limit).
 */
export async function startCampaign(input: CampaignInput, s: Settings, now = new Date()) {
  const { transactional, customers } = await resolveAudience(input, now);
  if (!customers.length)
    throw new HttpError(400, 'No eligible recipients for this audience', 'EMPTY_AUDIENCE');

  const campaign = await CampaignModel.create({
    subject: input.subject,
    heading: input.heading,
    body: input.body,
    imageUrl: input.imageUrl,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    segment: input.segment,
    tag: input.tag,
    recipientCount: customers.length,
    recipientIds: customers.map((c) => c._id),
    isTransactional: transactional,
    status: 'sending',
  });
  return sendNextBatch(campaign._id.toString(), s);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends the next batch (EMAIL_BATCH_SIZE, default 50) of a campaign, waiting EMAIL_BATCH_DELAY_MS
 * since the previous batch, and pauses the campaign once EMAIL_DAILY_LIMIT is reached. Customers
 * who unsubscribed since the campaign started are skipped. Safe to call again at any time:
 * a lock stops two tabs from sending the same batch.
 */
export async function sendNextBatch(id: string, s: Settings) {
  const now = new Date();
  const claimed = await CampaignModel.findOneAndUpdate(
    {
      _id: id,
      status: { $in: ['sending', 'paused'] },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
    },
    { $set: { lockedUntil: new Date(now.getTime() + 2 * 60_000) } },
    { new: true },
  );
  if (!claimed) {
    const existing = await CampaignModel.findById(id).lean();
    if (!existing) throw new HttpError(404, 'Campaign not found', 'NOT_FOUND');
    if (existing.status === 'sending' || existing.status === 'paused')
      throw new HttpError(409, 'This campaign is already sending. Please wait.', 'BUSY');
    return { campaign: toCampaignDTO(existing), quota: await emailQuota() };
  }

  try {
    const wait = claimed.lastBatchAt
      ? env.email.batchDelayMs - (Date.now() - claimed.lastBatchAt.getTime())
      : 0;
    if (wait > 0) await sleep(Math.min(wait, env.email.batchDelayMs));

    const quota = await emailQuota();
    const pending = claimed.recipientIds.length - claimed.cursor;
    const n = Math.min(env.email.batchSize, pending, quota.remaining ?? Infinity);
    if (n <= 0) {
      claimed.set({ status: 'paused', lockedUntil: null });
      await claimed.save();
      return { campaign: toCampaignDTO(claimed.toObject()), quota };
    }

    const ids = claimed.recipientIds.slice(claimed.cursor, claimed.cursor + n);
    // Re-check consent at send time: a resumed campaign must not reach people who unsubscribed.
    const customers = await CustomerModel.find({
      _id: { $in: ids },
      ...(claimed.isTransactional ? {} : eligible),
    }).lean<CustomerRow[]>();

    const input = toInput(claimed);
    let sent = 0;
    let failed = 0;
    const queue = [...customers];
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const r = await sendToCustomer(input, s, c, claimed.isTransactional, claimed._id);
        if (r.ok) sent++;
        else failed++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, customers.length) }, worker));

    const cursor = claimed.cursor + n;
    const sentCount = claimed.sentCount + sent;
    const failedCount = claimed.failedCount + failed;
    const done = cursor >= claimed.recipientIds.length;
    const after = await emailQuota();
    claimed.set({
      cursor,
      sentCount,
      failedCount,
      skippedCount: claimed.skippedCount + (n - customers.length),
      lastBatchAt: new Date(),
      lockedUntil: null,
      sentAt: claimed.sentAt ?? new Date(),
      status: done
        ? failedCount === 0
          ? 'sent'
          : sentCount === 0
            ? 'failed'
            : 'partial'
        : after.remaining === 0
          ? 'paused'
          : 'sending',
    });
    await claimed.save();
    return { campaign: toCampaignDTO(claimed.toObject()), quota: after };
  } catch (e) {
    await CampaignModel.updateOne({ _id: claimed._id }, { $set: { lockedUntil: null } });
    throw e;
  }
}

function toInput(c: CampaignRow): CampaignInput {
  return {
    subject: c.subject,
    heading: c.heading,
    body: c.body,
    imageUrl: c.imageUrl,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    segment: c.segment,
    tag: c.tag,
    customerIds: [],
  };
}

function sendToCustomer(
  input: CampaignInput,
  s: Settings,
  c: CustomerRow,
  transactional: boolean,
  campaignId: Types.ObjectId,
) {
  const content = renderFor(input, s, c, transactional);
  const headers = transactional
    ? undefined
    : {
        'List-Unsubscribe': `<${env.siteUrl}/api/unsubscribe/one-click?token=${encodeURIComponent(c.unsubscribeToken)}>, <${unsubscribeUrl(c.unsubscribeToken)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
  return sendEmail({
    type: transactional ? 'direct' : 'marketing',
    to: c.email,
    ...content,
    headers,
    campaignId,
  });
}
