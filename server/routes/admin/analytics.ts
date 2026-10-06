import { Router } from 'express';
import { z } from 'zod';
import { ah, parse } from '../../middleware/errors.js';
import { buildAnalytics } from '../../services/analytics.js';
import { getSettings } from '../../services/settingsService.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/',
  ah(async (req, res) => {
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional();
    const q = parse(
      z.object({
        range: z.enum(['week', '4w', '3m', 'custom']).default('week'),
        from: date,
        to: date,
      }),
      req.query,
    );
    res.json(await buildAnalytics(await getSettings(), q.range, q.from, q.to));
  }),
);
