import { Router } from 'express';
import { ah } from '../middleware/errors.js';
import { getMenu } from '../services/menuService.js';
import { getSettings, toPublicSettings } from '../services/settingsService.js';
import { getPickupOptions } from '../services/availability.js';
import type { PublicConfig } from '../../shared/types.js';
import { z } from 'zod';
import { HttpError, parse } from '../middleware/errors.js';
import { orderLimiter, publicPostLimiter } from '../middleware/rateLimit.js';
import { createOrder, toPublicOrder } from '../services/orderService.js';
import { verifyOrderToken } from '../services/orderToken.js';
import { OrderModel, toOrderDTO } from '../models/Order.js';
import { unsubscribeByToken } from '../services/unsubscribe.js';
import { orderIcs } from '../services/ics.js';

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

publicRouter.post(
  '/orders',
  orderLimiter,
  ah(async (req, res) => {
    // createOrder resolves only after the owner/customer emails have been attempted and logged.
    const { publicOrder, token } = await createOrder(req.body);
    res.status(201).json({ order: publicOrder, token });
  }),
);

/** Loads an order for its customer; the HMAC token proves they own the link. */
async function findOrderForCustomer(number: string, token: unknown) {
  if (
    typeof token !== 'string' ||
    !/^233-\d{4,}$/.test(number) ||
    !verifyOrderToken(number, token)
  ) {
    throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  }
  const row = await OrderModel.findOne({ number }).setOptions({ sanitizeFilter: true }).lean();
  if (!row) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  return toOrderDTO(row);
}

publicRouter.get(
  '/orders/:number',
  ah(async (req, res) => {
    const order = await findOrderForCustomer(req.params.number, req.query.t);
    res.json({ order: toPublicOrder(order, await getSettings()) });
  }),
);

publicRouter.get(
  '/orders/:number/ics',
  ah(async (req, res) => {
    const order = await findOrderForCustomer(req.params.number, req.query.t);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="233-kitchen-${order.number}.ics"`);
    res.send(orderIcs(order, await getSettings()));
  }),
);

publicRouter.post(
  '/unsubscribe',
  publicPostLimiter,
  ah(async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(100) }), req.body);
    if (!(await unsubscribeByToken(token)))
      throw new HttpError(404, 'This unsubscribe link is invalid or has expired.', 'NOT_FOUND');
    res.json({ ok: true });
  }),
);

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) used by Gmail/Yahoo. */
publicRouter.post(
  '/unsubscribe/one-click',
  publicPostLimiter,
  ah(async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(100) }), req.query);
    await unsubscribeByToken(token);
    res.json({ ok: true });
  }),
);
