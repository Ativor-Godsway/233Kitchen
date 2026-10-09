import { timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { CustomerModel } from '../models/Customer.js';

/**
 * Unsubscribe links carry "<customerId>.<secret>". The secret is 192 random bits stored on the
 * customer (Customer.unsubscribeToken). The customer is looked up by the non-secret id and the
 * secret is compared in constant time, so response timing can't reveal anything about it.
 */
export function unsubscribeLinkToken(c: {
  _id: Types.ObjectId | string;
  unsubscribeToken: string;
}) {
  return `${String(c._id)}.${c.unsubscribeToken}`;
}

const TOKEN = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{16,64})$/;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Opts the customer out of marketing. Returns false for an invalid or unknown token. */
export async function unsubscribeByToken(token: string, at = new Date()): Promise<boolean> {
  const m = TOKEN.exec(token);
  if (!m) return false;
  const customer = await CustomerModel.findById(m[1]).select('unsubscribeToken').lean();
  if (!customer || !safeEqual(customer.unsubscribeToken, m[2])) return false;
  await CustomerModel.updateOne(
    { _id: customer._id },
    { $set: { marketingConsent: false, unsubscribedAt: at } },
  );
  return true;
}
