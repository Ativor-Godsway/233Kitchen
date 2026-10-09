import { Router } from 'express';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import type { AdminRequest } from '../../middleware/auth.js';
import { campaignSchema } from '../../../shared/schemas.js';
import { CampaignModel, toCampaignDTO } from '../../models/Campaign.js';
import { getSettings } from '../../services/settingsService.js';
import {
  emailQuota,
  renderFor,
  resolveAudience,
  sendNextBatch,
  sendTest,
  startCampaign,
} from '../../services/campaignService.js';
import { z } from 'zod';

export const campaignsRouter = Router();

campaignsRouter.get(
  '/',
  ah(async (_req, res) => {
    const rows = await CampaignModel.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items: rows.map(toCampaignDTO) });
  }),
);

/** Recipient count + rendered preview for the composer. */
campaignsRouter.post(
  '/preview',
  ah(async (req, res) => {
    const input = parse(campaignSchema, req.body);
    const s = await getSettings();
    const { transactional, customers } = await resolveAudience(input);
    const sample = customers[0] ?? null;
    // With no recipients yet, preview without a personal greeting rather than a made-up name.
    const content = renderFor(input, s, sample, transactional);
    res.json({
      recipientCount: customers.length,
      quota: await emailQuota(),
      transactional,
      sample: customers.slice(0, 5).map((c) => ({ name: c.name, email: c.email })),
      html: content.html,
      subject: content.subject,
    });
  }),
);

campaignsRouter.post(
  '/test',
  ah(async (req: AdminRequest, res) => {
    const input = parse(campaignSchema, req.body);
    const s = await getSettings();
    // "Send test to me" goes to the logged-in admin.
    const to = req.admin!.email;
    const r = await sendTest(input, s, to);
    if (!r.ok)
      throw new HttpError(502, `Test email failed: ${r.error ?? 'unknown error'}`, 'EMAIL_FAILED');
    res.json({ ok: true, to, status: r.status });
  }),
);

/** Creates the campaign and sends the first batch; the composer then calls /:id/continue. */
campaignsRouter.post(
  '/send',
  ah(async (req, res) => {
    const input = parse(campaignSchema, req.body);
    res.status(201).json(await startCampaign(input, await getSettings()));
  }),
);

/** Sends the next batch of a campaign that is in progress or paused at the daily limit. */
campaignsRouter.post(
  '/:id/continue',
  ah(async (req, res) => {
    const { id } = parse(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }), req.params);
    res.json(await sendNextBatch(id, await getSettings()));
  }),
);

campaignsRouter.get(
  '/quota',
  ah(async (_req, res) => {
    res.json(await emailQuota());
  }),
);
