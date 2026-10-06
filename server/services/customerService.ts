import { Types } from 'mongoose';
import { CustomerModel, newUnsubscribeToken } from '../models/Customer.js';
import { OrderModel } from '../models/Order.js';

/** Creates or updates the customer for an order (keyed by email). */
export async function upsertCustomerForOrder(input: {
  name: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  at: Date;
}) {
  const set: Record<string, unknown> = { name: input.name, phone: input.phone };
  if (input.marketingConsent) {
    // A fresh opt-in re-subscribes a customer who had unsubscribed.
    Object.assign(set, { marketingConsent: true, consentAt: input.at, unsubscribedAt: null });
  }
  return CustomerModel.findOneAndUpdate(
    { email: input.email.toLowerCase() },
    {
      $set: set,
      $setOnInsert: {
        email: input.email.toLowerCase(),
        firstOrderAt: input.at,
        unsubscribeToken: newUnsubscribeToken(),
        ...(input.marketingConsent ? {} : { marketingConsent: false }),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).setOptions({ sanitizeFilter: true });
}

/** Recomputes order count / spend / first+last order from non-cancelled orders. */
export async function recomputeCustomerStats(
  customerId: Types.ObjectId | string | null | undefined,
) {
  if (!customerId) return;
  const id = new Types.ObjectId(String(customerId));
  const [agg] = await OrderModel.aggregate<{ n: number; spent: number; first: Date; last: Date }>([
    { $match: { customerId: id, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        n: { $sum: 1 },
        spent: { $sum: '$total' },
        first: { $min: '$createdAt' },
        last: { $max: '$createdAt' },
      },
    },
  ]);
  await CustomerModel.updateOne(
    { _id: id },
    {
      $set: {
        orderCount: agg?.n ?? 0,
        totalSpent: agg?.spent ?? 0,
        ...(agg ? { firstOrderAt: agg.first, lastOrderAt: agg.last } : {}),
      },
    },
  );
}
