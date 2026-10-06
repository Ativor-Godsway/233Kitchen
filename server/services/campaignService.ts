import { Types } from 'mongoose';
import { CustomerModel, type CustomerRow } from '../models/Customer.js';
import { CampaignModel, toCampaignDTO } from '../models/Campaign.js';
import { messageEmail, unsubscribeUrl } from '../emails/templates.js';
import { sendEmail } from './emailService.js';
import { env } from '../env.js';
import type { CampaignInput } from '../../shared/schemas.js';
import type { Settings } from '../../shared/types.js';
import { HttpError } from '../middleware/errors.js';

const DAY = 24 * 60 * 60 * 1000;

/** Only opted-in, never-unsubscribed customers may receive marketing. */
const eligible = { marketingConsent: true, unsubscribedAt: null };

/**
 * Resolves recipients. "single" is a one-to-one (transactional) message and
 * ignores marketing consent; every other segment is marketing and is filtered
 * to opted-in customers.
 */
export async function resolveAudience(input: Pick<CampaignInput, 'segment' | 'tag' | 'customerIds'>, now = new Date()) {
  const ids = input.customerIds.map((id) => new Types.ObjectId(id));
  let filter: Record<string, unknown>;
  switch (input.segment) {
    case 'single':
      if (ids.length !== 1) throw new HttpError(400, 'Choose exactly one customer', 'VALIDATION');
      return { transactional: true, customers: await CustomerModel.find({ _id: ids[0] }).lean<CustomerRow[]>() };
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
  return { transactional: false, customers: await CustomerModel.find(filter).sort({ lastOrderAt: -1 }).lean<CustomerRow[]>() };
}

export function renderFor(input: CampaignInput, s: Settings, c: Pick<CustomerRow, 'name' | 'unsubscribeToken'> | null, transactional: boolean) {
  return messageEmail(input, s, {
    firstName: c?.name.split(' ')[0],
    unsubscribeToken: c?.unsubscribeToken,
    marketing: !transactional,
  });
}

export async function sendTest(input: CampaignInput, s: Settings, to: string) {
  const content = renderFor(input, s, { name: 'Ama Mensah', unsubscribeToken: 'test-preview-token' }, input.segment === 'single');
  return sendEmail({ type: 'test', to, ...content, subject: `[TEST] ${content.subject}` });
}

/** Sends a campaign with limited concurrency and records the outcome. */
export async function sendCampaign(input: CampaignInput, s: Settings) {
  const { transactional, customers } = await resolveAudience(input);
  if (!customers.length) throw new HttpError(400, 'No eligible recipients for this audience', 'EMPTY_AUDIENCE');

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
    isTransactional: transactional,
    status: 'sending',
  });

  let sent = 0;
  let failed = 0;
  const queue = [...customers];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const content = renderFor(input, s, c, transactional);
      const headers = transactional
        ? undefined
        : {
            'List-Unsubscribe': `<${env.siteUrl}/api/unsubscribe/one-click?token=${encodeURIComponent(c.unsubscribeToken)}>, <${unsubscribeUrl(c.unsubscribeToken)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          };
      const r = await sendEmail({ type: transactional ? 'direct' : 'marketing', to: c.email, ...content, headers, campaignId: campaign._id });
      if (r.ok) sent++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, customers.length) }, worker));

  campaign.set({ sentCount: sent, failedCount: failed, sentAt: new Date(), status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial' });
  await campaign.save();
  return toCampaignDTO(campaign.toObject());
}
