import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import { MenuItemModel, toMenuItem } from '../../models/MenuItem.js';
import { menuAvailabilitySchema, menuItemSchema } from '../../../shared/schemas.js';
import { getMenu } from '../../services/menuService.js';

export const menuRouter = Router();

const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

menuRouter.get(
  '/',
  ah(async (_req, res) => {
    res.json({ items: await getMenu() });
  }),
);

menuRouter.post(
  '/',
  ah(async (req, res) => {
    const body = parse(menuItemSchema, req.body);
    if (await MenuItemModel.exists({ slug: body.slug })) throw new HttpError(409, 'An item with that URL slug already exists', 'DUPLICATE');
    const doc = await MenuItemModel.create({ ...body, image: body.image || null });
    res.status(201).json({ item: toMenuItem(doc.toObject()) });
  }),
);

menuRouter.put(
  '/:id',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    const body = parse(menuItemSchema, req.body);
    const clash = await MenuItemModel.findOne({ slug: body.slug, _id: { $ne: id } }).lean();
    if (clash) throw new HttpError(409, 'Another item already uses that URL slug', 'DUPLICATE');
    const doc = await MenuItemModel.findByIdAndUpdate(id, { $set: { ...body, image: body.image || null } }, { new: true, runValidators: true }).lean();
    if (!doc) throw new HttpError(404, 'Menu item not found', 'NOT_FOUND');
    res.json({ item: toMenuItem(doc) });
  }),
);

/** Quick sold-out toggle for an item or one of its options. */
menuRouter.patch(
  '/:id/availability',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    const body = parse(menuAvailabilitySchema, req.body);
    const doc = await MenuItemModel.findById(id);
    if (!doc) throw new HttpError(404, 'Menu item not found', 'NOT_FOUND');
    if (body.groupKey && body.optionKey) {
      const option = doc.optionGroups.find((g) => g.key === body.groupKey)?.options.find((o) => o.key === body.optionKey);
      if (!option) throw new HttpError(404, 'Option not found', 'NOT_FOUND');
      option.isAvailable = body.isAvailable;
    } else {
      doc.isAvailable = body.isAvailable;
    }
    await doc.save();
    res.json({ item: toMenuItem(doc.toObject()) });
  }),
);

menuRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const { id } = parse(idParam, req.params);
    // Past orders keep their own snapshot of names and prices, so deleting is safe.
    const r = await MenuItemModel.deleteOne({ _id: id });
    if (!r.deletedCount) throw new HttpError(404, 'Menu item not found', 'NOT_FOUND');
    res.json({ ok: true });
  }),
);
