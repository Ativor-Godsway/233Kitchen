import { Router } from 'express';
import { ah, parse } from '../../middleware/errors.js';
import { settingsSchema } from '../../../shared/schemas.js';
import { getSettings, saveSettings } from '../../services/settingsService.js';
import { activeProvider } from '../../services/emailService.js';
import type { Settings } from '../../../shared/types.js';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  ah(async (_req, res) => {
    res.json({ settings: await getSettings(), emailProvider: activeProvider() });
  }),
);

settingsRouter.put(
  '/',
  ah(async (req, res) => {
    const next = parse(settingsSchema, req.body) as Settings;
    next.closedDates = [...new Set(next.closedDates)].sort();
    next.pickupDays = [...new Set(next.pickupDays)].sort();
    res.json({ settings: await saveSettings(next), emailProvider: activeProvider() });
  }),
);
