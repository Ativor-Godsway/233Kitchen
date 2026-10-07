import { env } from '../env.js';
import { createOrderSchema, normalizeUsPhone } from '../../shared/schemas.js';
import { priceOrder } from '../../shared/pricing.js';
import { isDateOrderable, formatPickupDate } from '../../shared/schedule.js';
import type { OrderDTO, PublicOrderDTO, Settings } from '../../shared/types.js';
import { HttpError } from '../middleware/errors.js';
import { OrderModel, toOrderDTO, ACTIVE_STATUSES, type OrderRow } from '../models/Order.js';
import { nextSequence, formatOrderNumber } from '../models/Counter.js';
import { getMenu } from './menuService.js';
import { getSettings } from './settingsService.js';
import { recomputeCustomerStats, upsertCustomerForOrder } from './customerService.js';
import { sendEmail } from './emailService.js';
import { orderToken } from './orderToken.js';
import {
  customerOrderReceivedEmail,
  customerStatusEmail,
  ownerNewOrderEmail,
} from '../emails/templates.js';

export function toPublicOrder(o: OrderDTO, s: Settings): PublicOrderDTO {
  return {
    number: o.number,
    items: o.items,
    total: o.total,
    customerName: o.customer.name,
    email: o.customer.email,
    pickupDate: o.pickupDate,
    pickupDateLabel: formatPickupDate(o.pickupDate, s.timezone),
    pickupWindowLabel: o.pickupWindowLabel,
    fulfilment: o.fulfilment,
    status: o.status,
    paymentInstructions: s.paymentInstructions,
    pickupAddressPublic: s.pickupAddressPublic,
    businessPhone: s.businessPhone,
    createdAt: o.createdAt,
  };
}

/** Owner + customer emails for a new order. Runs after the order is saved; never throws. */
export async function sendNewOrderEmails(order: OrderDTO, s: Settings) {
  const owner = ownerNewOrderEmail(order);
  const customer = customerOrderReceivedEmail(order, s, orderToken(order.number));
  const base = { orderId: order.id, orderNumber: order.number };
  // OWNER_EMAIL from .env always receives new orders, plus any extra addresses set in admin Settings.
  const ownerRecipients = [
    ...new Set(
      [env.ownerEmail, ...s.notificationEmails].filter(Boolean).map((e) => e.toLowerCase()),
    ),
  ];
  await Promise.allSettled([
    ...ownerRecipients.map((to) =>
      sendEmail({ ...base, type: 'owner_new_order', to, ...owner, replyTo: order.customer.email }),
    ),
    sendEmail({ ...base, type: 'customer_order_received', to: order.customer.email, ...customer }),
  ]);
}

export async function sendStatusEmail(order: OrderDTO, s: Settings, note?: string) {
  const content = customerStatusEmail(order, s, orderToken(order.number), note);
  return sendEmail({
    type: 'customer_status_update',
    to: order.customer.email,
    ...content,
    orderId: order.id,
    orderNumber: order.number,
  });
}

export async function countActiveInWindow(date: string, windowId: string) {
  return OrderModel.countDocuments({
    pickupDate: date,
    pickupWindowId: windowId,
    status: { $in: ACTIVE_STATUSES },
  });
}

/**
 * Places an order. Validates input, re-prices every line from the database,
 * enforces cutoff + capacity, assigns a friendly number, saves, upserts the
 * customer, then sends emails (email failures never fail the order).
 */
export async function createOrder(raw: unknown, now = new Date()) {
  if (
    raw &&
    typeof raw === 'object' &&
    'website' in raw &&
    String((raw as { website: unknown }).website ?? '').length > 0
  ) {
    throw new HttpError(400, 'Invalid submission', 'SPAM');
  }
  const input = createOrderSchema.parse(raw);
  const phone = normalizeUsPhone(input.phone)!;

  const settings = await getSettings();
  if (settings.orderingPaused) throw new HttpError(409, settings.pausedMessage, 'ORDERING_PAUSED');
  if (!isDateOrderable(input.pickupDate, now, settings)) {
    throw new HttpError(
      409,
      'Orders for that pickup date have closed. Please choose another date.',
      'CUTOFF_PASSED',
    );
  }
  const window = settings.windows.find((w) => w.id === input.pickupWindowId);
  if (!window) throw new HttpError(400, 'Please choose a valid pickup time.', 'INVALID_WINDOW');

  const priced = priceOrder(await getMenu(), input.items);

  if (
    window.capacity !== null &&
    (await countActiveInWindow(input.pickupDate, window.id)) >= window.capacity
  ) {
    throw new HttpError(
      409,
      `The ${window.label} pickup window is full. Please choose another time.`,
      'SLOT_FULL',
    );
  }

  const customer = await upsertCustomerForOrder({
    name: input.name,
    email: input.email,
    phone,
    marketingConsent: input.marketingConsent,
    at: now,
  });

  const seq = await nextSequence('order');
  const doc = await OrderModel.create({
    number: formatOrderNumber(seq),
    seq,
    items: priced.lines,
    subtotal: priced.subtotal,
    total: priced.total,
    customer: { name: input.name, phone, email: input.email },
    customerId: customer?._id ?? null,
    pickupDate: input.pickupDate,
    pickupWindowId: window.id,
    pickupWindowLabel: window.label,
    fulfilment: input.fulfilment,
    notes: input.notes,
    marketingConsent: input.marketingConsent,
    timezone: settings.timezone,
    statusHistory: [{ status: 'new', at: now, by: 'customer', notified: false }],
  });
  const order = toOrderDTO(doc.toObject() as OrderRow);

  await recomputeCustomerStats(customer?._id);
  // Must be awaited BEFORE the HTTP response: Vercel can freeze the function once it responds,
  // which would silently drop in-flight emails. sendNewOrderEmails never throws (failures are
  // recorded in EmailLog), so the order itself can't fail here.
  await sendNewOrderEmails(order, settings);

  return {
    order,
    publicOrder: toPublicOrder(order, settings),
    token: orderToken(order.number),
    settings,
  };
}
