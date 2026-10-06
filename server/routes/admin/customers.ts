import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import { CustomerModel, toCustomerDTO } from '../../models/Customer.js';
import { OrderModel, toOrderDTO } from '../../models/Order.js';
import { customerUpdateSchema } from '../../../shared/schemas.js';
import { formatMoney } from '../../../shared/pricing.js';
import { toCsv } from '../../services/prepSheet.js';

export const customersRouter = Router();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  consent: z.enum(['all', 'opted_in', 'not_opted_in']).default('all'),
  tag: z.string().trim().max(30).optional(),
  sort: z.enum(['lastOrder', 'totalSpent', 'orderCount', 'name', 'newest']).default('lastOrder'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

function buildFilter(q: z.infer<typeof listQuery>) {
  const filter: Record<string, unknown> = {};
  if (q.consent === 'opted_in')
    Object.assign(filter, { marketingConsent: true, unsubscribedAt: null });
  if (q.consent === 'not_opted_in')
    filter.$or = [{ marketingConsent: false }, { unsubscribedAt: { $ne: null } }];
  if (q.tag) filter.tags = q.tag.toLowerCase();
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const digits = q.q.replace(/\D/g, '');
    const search = [
      { name: rx },
      { email: rx },
      ...(digits.length >= 3 ? [{ phone: new RegExp(digits.split('').join('\\D*')) }] : []),
    ];
    filter.$and = [{ $or: search }];
  }
  return filter;
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  lastOrder: { lastOrderAt: -1 },
  totalSpent: { totalSpent: -1 },
  orderCount: { orderCount: -1 },
  name: { name: 1 },
  newest: { createdAt: -1 },
};

customersRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(listQuery, req.query);
    const filter = buildFilter(q);
    const [rows, total] = await Promise.all([
      CustomerModel.find(filter)
        .sort(SORTS[q.sort])
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean(),
      CustomerModel.countDocuments(filter),
    ]);
    res.json({ items: rows.map(toCustomerDTO), total, page: q.page, pageSize: q.pageSize });
  }),
);

customersRouter.get(
  '/tags',
  ah(async (_req, res) => {
    const tags = (await CustomerModel.distinct('tags')).filter(Boolean).sort();
    res.json({ tags });
  }),
);

customersRouter.get(
  '/export.csv',
  ah(async (req, res) => {
    const q = parse(listQuery, req.query);
    const rows = await CustomerModel.find(buildFilter(q)).sort(SORTS[q.sort]).lean();
    const csv = toCsv([
      [
        'Name',
        'Email',
        'Phone',
        'Orders',
        'Total spent',
        'First order',
        'Last order',
        'Marketing consent',
        'Tags',
        'Notes',
      ],
      ...rows.map((r) => {
        const c = toCustomerDTO(r);
        return [
          c.name,
          c.email,
          c.phone,
          c.orderCount,
          formatMoney(c.totalSpent),
          c.firstOrderAt?.slice(0, 10) ?? '',
          c.lastOrderAt?.slice(0, 10) ?? '',
          c.marketingConsent ? 'Yes' : 'No',
          c.tags.join('; '),
          c.notes,
        ];
      }),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  }),
);

const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

customersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    const c = await CustomerModel.findById(id).lean();
    if (!c) throw new HttpError(404, 'Customer not found', 'NOT_FOUND');
    const orders = await OrderModel.find({ customerId: c._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ customer: toCustomerDTO(c), orders: orders.map(toOrderDTO) });
  }),
);

customersRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    const body = parse(customerUpdateSchema, req.body);
    const set: Record<string, unknown> = { ...body };
    if (body.tags) set.tags = [...new Set(body.tags)];
    if (body.marketingConsent === true)
      Object.assign(set, { consentAt: new Date(), unsubscribedAt: null });
    if (body.marketingConsent === false) set.unsubscribedAt = new Date();
    const c = await CustomerModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
    if (!c) throw new HttpError(404, 'Customer not found', 'NOT_FOUND');
    res.json({ customer: toCustomerDTO(c) });
  }),
);
