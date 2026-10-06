import mongoose, { Schema, Types } from 'mongoose';
import type {
  Fulfilment,
  OrderDTO,
  OrderStatus,
  PaymentStatus,
  PricedLine,
  StatusHistoryEntry,
} from '../../shared/types.js';
import { formatPickupDate } from '../../shared/schedule.js';

export interface OrderRow {
  _id: Types.ObjectId;
  number: string;
  seq: number;
  items: PricedLine[];
  subtotal: number;
  total: number;
  customer: { name: string; phone: string; email: string };
  customerId: Types.ObjectId | null;
  pickupDate: string;
  pickupWindowId: string;
  pickupWindowLabel: string;
  fulfilment: Fulfilment;
  notes: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  statusHistory: Array<Omit<StatusHistoryEntry, 'at'> & { at: Date }>;
  internalNotes: string;
  marketingConsent: boolean;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const selectionSchema = new Schema(
  {
    groupKey: String,
    groupName: String,
    optionKey: String,
    name: String,
    qty: Number,
    unitPrice: Number,
  },
  { _id: false },
);

const lineSchema = new Schema(
  {
    menuItemId: String,
    slug: String,
    name: String,
    unitBase: Number,
    selections: { type: [selectionSchema], default: [] },
    quantity: Number,
    notes: { type: String, default: '' },
    unitTotal: Number,
    lineTotal: Number,
  },
  { _id: false },
);

const orderSchema = new Schema<OrderRow>(
  {
    number: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    items: { type: [lineSchema], required: true },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    pickupDate: { type: String, required: true, index: true },
    pickupWindowId: { type: String, required: true },
    pickupWindowLabel: { type: String, required: true },
    fulfilment: { type: String, enum: ['pickup', 'uber'], required: true },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'new',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid_zelle', 'paid_applepay', 'paid_cash'],
      default: 'unpaid',
      index: true,
    },
    statusHistory: [
      new Schema(
        { status: String, at: Date, by: String, notified: Boolean, note: String },
        { _id: false },
      ),
    ],
    internalNotes: { type: String, default: '' },
    marketingConsent: { type: Boolean, default: false },
    timezone: { type: String, default: 'America/New_York' },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ pickupDate: 1, pickupWindowId: 1, status: 1 });
orderSchema.index({ 'customer.email': 1 });

export const OrderModel =
  (mongoose.models.Order as mongoose.Model<OrderRow>) ||
  mongoose.model<OrderRow>('Order', orderSchema);

export function toOrderDTO(o: OrderRow): OrderDTO {
  return {
    id: o._id.toString(),
    number: o.number,
    items: o.items.map((l) => ({
      menuItemId: l.menuItemId,
      slug: l.slug,
      name: l.name,
      unitBase: l.unitBase,
      selections: (l.selections ?? []).map((s) => ({
        groupKey: s.groupKey,
        groupName: s.groupName,
        optionKey: s.optionKey,
        name: s.name,
        qty: s.qty,
        unitPrice: s.unitPrice,
      })),
      quantity: l.quantity,
      notes: l.notes ?? '',
      unitTotal: l.unitTotal,
      lineTotal: l.lineTotal,
    })),
    subtotal: o.subtotal,
    total: o.total,
    customer: { name: o.customer.name, phone: o.customer.phone, email: o.customer.email },
    customerId: o.customerId ? o.customerId.toString() : null,
    pickupDate: o.pickupDate,
    pickupDateLabel: formatPickupDate(o.pickupDate, o.timezone || 'America/New_York'),
    pickupWindowId: o.pickupWindowId,
    pickupWindowLabel: o.pickupWindowLabel,
    fulfilment: o.fulfilment,
    notes: o.notes ?? '',
    status: o.status,
    paymentStatus: o.paymentStatus,
    statusHistory: (o.statusHistory ?? []).map((h) => ({
      status: h.status,
      at: new Date(h.at).toISOString(),
      by: h.by,
      notified: !!h.notified,
      ...(h.note ? { note: h.note } : {}),
    })),
    internalNotes: o.internalNotes ?? '',
    marketingConsent: !!o.marketingConsent,
    createdAt: new Date(o.createdAt).toISOString(),
    updatedAt: new Date(o.updatedAt).toISOString(),
  };
}

/** Statuses that occupy capacity in a pickup window. */
export const ACTIVE_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'completed',
];
