import mongoose, { Schema, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import type { CustomerDTO } from '../../shared/types.js';

export interface CustomerRow {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  marketingConsent: boolean;
  consentAt: Date | null;
  unsubscribedAt: Date | null;
  unsubscribeToken: string;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export const newUnsubscribeToken = () => randomBytes(24).toString('base64url');

const customerSchema = new Schema<CustomerRow>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    orderCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    firstOrderAt: { type: Date, default: null },
    lastOrderAt: { type: Date, default: null, index: true },
    marketingConsent: { type: Boolean, default: false, index: true },
    consentAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    unsubscribeToken: { type: String, required: true, unique: true, default: newUnsubscribeToken },
    tags: { type: [String], default: [], index: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

export const CustomerModel =
  (mongoose.models.Customer as mongoose.Model<CustomerRow>) || mongoose.model<CustomerRow>('Customer', customerSchema);

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export function toCustomerDTO(c: CustomerRow): CustomerDTO {
  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email,
    phone: c.phone ?? '',
    orderCount: c.orderCount ?? 0,
    totalSpent: c.totalSpent ?? 0,
    firstOrderAt: iso(c.firstOrderAt),
    lastOrderAt: iso(c.lastOrderAt),
    marketingConsent: !!c.marketingConsent && !c.unsubscribedAt,
    unsubscribedAt: iso(c.unsubscribedAt),
    tags: c.tags ?? [],
    notes: c.notes ?? '',
    createdAt: iso(c.createdAt)!,
  };
}
