import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import type { AdminRequest } from '../../middleware/auth.js';
import { OrderModel, toOrderDTO, type OrderRow } from '../../models/Order.js';
import { EmailLogModel, toEmailLogDTO } from '../../models/EmailLog.js';
import { orderUpdateSchema } from '../../../shared/schemas.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../../shared/constants.js';
import { formatPickupDate, todayIn } from '../../../shared/schedule.js';
import type { OrderStatus, PaymentStatus } from '../../../shared/types.js';
import { getSettings } from '../../services/settingsService.js';
import { sendStatusEmail } from '../../services/orderService.js';
import { recomputeCustomerStats } from '../../services/customerService.js';
import { buildPrepSheet, prepSheetCsv } from '../../services/prepSheet.js';

export const ordersRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['all', 'active', ...ORDER_STATUSES] as [string, ...string[]]).optional(),
  paymentStatus: z.enum(['all', ...PAYMENT_STATUSES] as [string, ...string[]]).optional(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(['newest', 'oldest', 'pickup']).default('newest'),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

ordersRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(listQuery, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status === 'active') filter.status = { $nin: ['completed', 'cancelled'] };
    else if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.paymentStatus && q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;
    if (q.pickupDate) filter.pickupDate = q.pickupDate;
    if (q.customerId) filter.customerId = new Types.ObjectId(q.customerId);
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      const digits = q.q.replace(/\D/g, '');
      filter.$or = [
        { number: rx },
        { 'customer.name': rx },
        { 'customer.email': rx },
        ...(digits.length >= 3 ? [{ 'customer.phone': new RegExp(digits.split('').join('\\D*')) }] : []),
      ];
    }
    const sort: Record<string, 1 | -1> =
      q.sort === 'oldest' ? { createdAt: 1 } : q.sort === 'pickup' ? { pickupDate: 1, pickupWindowId: 1, seq: 1 } : { createdAt: -1 };
    const [rows, total, counts] = await Promise.all([
      OrderModel.find(filter).sort(sort).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean(),
      OrderModel.countDocuments(filter),
      OrderModel.aggregate<{ _id: OrderStatus; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    res.json({
      items: rows.map(toOrderDTO),
      total,
      page: q.page,
      pageSize: q.pageSize,
      statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
    });
  }),
);

/** Polled every 20s by the admin for new-order alerts. */
ordersRouter.get(
  '/latest',
  ah(async (req, res) => {
    const { since } = parse(z.object({ since: z.string().datetime().optional() }), req.query);
    const now = new Date();
    const rows = since
      ? await OrderModel.find({ createdAt: { $gt: new Date(since) } }).sort({ createdAt: 1 }).limit(20).lean()
      : [];
    const newCount = await OrderModel.countDocuments({ status: 'new' });
    res.json({ orders: rows.map(toOrderDTO), newCount, now: now.toISOString() });
  }),
);

/** Pickup dates that have orders, plus upcoming open dates, for selectors. */
ordersRouter.get(
  '/pickup-dates',
  ah(async (_req, res) => {
    const s = await getSettings();
    const rows = await OrderModel.aggregate<{ _id: string; n: number; active: number }>([
      {
        $group: {
          _id: '$pickupDate',
          n: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, 1] } },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 60 },
    ]);
    const today = todayIn(s.timezone);
    res.json({
      today,
      dates: rows.map((r) => ({ date: r._id, label: formatPickupDate(r._id, s.timezone), orders: r.active, isPast: r._id < today })),
    });
  }),
);

ordersRouter.get(
  '/prep-sheet',
  ah(async (req, res) => {
    const { date } = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.query);
    res.json(await buildPrepSheet(date, await getSettings()));
  }),
);

ordersRouter.get(
  '/prep-sheet.csv',
  ah(async (req, res) => {
    const { date } = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.query);
    const sheet = await buildPrepSheet(date, await getSettings());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prep-${date}.csv"`);
    res.send(prepSheetCsv(sheet));
  }),
);

const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id') });

ordersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    const row = await OrderModel.findById(id).lean();
    if (!row) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
    const emails = await EmailLogModel.find({ orderId: row._id }).sort({ createdAt: -1 }).lean();
    res.json({ order: toOrderDTO(row), emails: emails.map(toEmailLogDTO) });
  }),
);

ordersRouter.patch(
  '/:id',
  ah(async (req: AdminRequest, res) => {
    const { id } = parse(idParam, req.params);
    const body = parse(orderUpdateSchema, req.body);
    const doc = await OrderModel.findById(id);
    if (!doc) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
    const settings = await getSettings();

    const prevStatus = doc.status;
    const statusChanged = !!body.status && body.status !== prevStatus;
    const notify = statusChanged && (body.notifyCustomer ?? settings.notifyOnStatus.includes(body.status as OrderStatus));

    if (body.paymentStatus) doc.paymentStatus = body.paymentStatus as PaymentStatus;
    if (body.internalNotes !== undefined) doc.internalNotes = body.internalNotes;
    if (statusChanged) {
      doc.status = body.status as OrderStatus;
      doc.statusHistory.push({ status: doc.status, at: new Date(), by: req.admin!.email, notified: notify, note: body.statusNote || undefined });
    }
    await doc.save();

    const order = toOrderDTO(doc.toObject() as OrderRow);
    if (statusChanged && (prevStatus === 'cancelled' || order.status === 'cancelled')) await recomputeCustomerStats(order.customerId);

    let email: { ok: boolean; error?: string } | null = null;
    if (notify) {
      const r = await sendStatusEmail(order, settings, body.statusNote);
      email = { ok: r.ok, ...(r.error ? { error: r.error } : {}) };
      if (!r.ok) {
        // Record that the notification did not go out.
        const last = doc.statusHistory[doc.statusHistory.length - 1];
        if (last) last.notified = false;
        await doc.save();
        order.statusHistory[order.statusHistory.length - 1].notified = false;
      }
    }
    res.json({ order, email });
  }),
);
