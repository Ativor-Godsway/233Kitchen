import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { MenuItem } from '../../shared/types.js';

const optionSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false },
);

const groupSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['single', 'multi', 'quantity'], required: true },
    required: { type: Boolean, default: false },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 5 },
    options: { type: [optionSchema], default: [] },
  },
  { _id: false },
);

const menuItemSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['mains', 'desserts-drinks'], required: true },
    basePrice: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    optionGroups: { type: [groupSchema], default: [] },
  },
  { timestamps: true },
);

export type MenuItemDoc = HydratedDocument<InferSchemaType<typeof menuItemSchema>>;

export const MenuItemModel =
  (mongoose.models.MenuItem as mongoose.Model<InferSchemaType<typeof menuItemSchema>>) ||
  mongoose.model('MenuItem', menuItemSchema);

export function toMenuItem(doc: MenuItemDoc | (InferSchemaType<typeof menuItemSchema> & { _id: unknown })): MenuItem {
  const d = doc as InferSchemaType<typeof menuItemSchema> & { _id: { toString(): string } };
  return {
    id: d._id.toString(),
    name: d.name,
    slug: d.slug,
    description: d.description ?? '',
    category: d.category as MenuItem['category'],
    basePrice: d.basePrice,
    image: d.image ?? null,
    isAvailable: d.isAvailable ?? true,
    sortOrder: d.sortOrder ?? 0,
    optionGroups: (d.optionGroups ?? []).map((g) => ({
      key: g.key,
      name: g.name,
      type: g.type as 'single' | 'multi' | 'quantity',
      required: !!g.required,
      min: g.min ?? 0,
      max: g.max ?? 5,
      options: (g.options ?? []).map((o) => ({
        key: o.key,
        name: o.name,
        price: o.price,
        isAvailable: o.isAvailable ?? true,
      })),
    })),
  };
}
