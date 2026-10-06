import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

/** Signed, unguessable token that lets a customer view their own order page. */
export function orderToken(number: string): string {
  return createHmac('sha256', env.jwtSecret)
    .update(`order:${number}`)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyOrderToken(number: string, token: string): boolean {
  const expected = Buffer.from(orderToken(number));
  const given = Buffer.from(String(token));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
