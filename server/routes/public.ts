import { Router } from 'express';
import { ah } from '../middleware/errors.js';
import { getMenu } from '../services/menuService.js';
import { getSettings, toPublicSettings } from '../services/settingsService.js';
import { getPickupOptions } from '../services/availability.js';
import type { PublicConfig } from '../../shared/types.js';

export const publicRouter = Router();

publicRouter.get(
  '/menu',
  ah(async (_req, res) => {
    res.json({ items: await getMenu() });
  }),
);

publicRouter.get(
  '/config',
  ah(async (_req, res) => {
    const settings = await getSettings();
    const body: PublicConfig = {
      settings: toPublicSettings(settings),
      pickupDates: await getPickupOptions(settings),
      now: new Date().toISOString(),
    };
    res.json(body);
  }),
);
