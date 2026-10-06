import { Router } from 'express';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import type { AdminRequest } from '../../middleware/auth.js';
import { campaignSchema } from '../../../shared/schemas.js';
import { CampaignModel, toCampaignDTO } from '../../models/Campaign.js';
import { getSettings } from '../../services/settingsService.js';
import {
  renderFor,
  resolveAudience,
  sendCampaign,
  sendTest,
} from '../../services/campaignService.js';

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
    const content = renderFor(
      input,
      s,
      sample ?? { name: 'Ama Mensah', unsubscribeToken: 'preview' },
      transactional,
    );
    res.json({
      recipientCount: customers.length,
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
    const to = s.notificationEmails[0] || req.admin!.email;
    const r = await sendTest(input, s, to);
    if (!r.ok)
      throw new HttpError(502, `Test email failed: ${r.error ?? 'unknown error'}`, 'EMAIL_FAILED');
    res.json({ ok: true, to, status: r.status });
  }),
);

campaignsRouter.post(
  '/send',
  ah(async (req, res) => {
    const input = parse(campaignSchema, req.body);
    const campaign = await sendCampaign(input, await getSettings());
    res.status(201).json({ campaign });
  }),
);
