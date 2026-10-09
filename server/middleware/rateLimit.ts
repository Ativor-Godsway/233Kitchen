import rateLimit, { type Store, type Options, type IncrementResponse } from 'express-rate-limit';
import { RateLimitModel } from '../models/RateLimit.js';
import { env } from '../env.js';

/**
 * express-rate-limit store backed by MongoDB, so limits hold across all
 * serverless instances (in-memory counters would reset per instance).
 */
class MongoStore implements Store {
  windowMs = 60_000;
  prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private id(key: string) {
    return `${this.prefix}:${key}`;
  }
  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const id = this.id(key);
    // Reset expired windows first (TTL cleanup can lag up to a minute).
    await RateLimitModel.deleteOne({ _id: id, expiresAt: { $lte: new Date(now) } });
    const doc = await RateLimitModel.findOneAndUpdate(
      { _id: id },
      { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date(now + this.windowMs) } },
      { upsert: true, new: true },
    ).lean();
    return { totalHits: doc!.hits, resetTime: doc!.expiresAt };
  }
  async decrement(key: string) {
    await RateLimitModel.updateOne({ _id: this.id(key) }, { $inc: { hits: -1 } });
  }
  async resetKey(key: string) {
    await RateLimitModel.deleteOne({ _id: this.id(key) });
  }
}

function make(
  prefix: string,
  windowMs: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false,
  keyGenerator?: Options['keyGenerator'],
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new MongoStore(prefix),
    ...(keyGenerator ? { keyGenerator } : {}),
    // Only ever skipped under the test runner (env.isTest is always false in production).
    skip: () => env.isTest && process.env.K233_TEST_RATE_LIMIT !== '1',
    message: { error: message, code: 'RATE_LIMITED' },
    // Mongo outage should not lock everyone out of ordering.
    passOnStoreError: true,
    skipSuccessfulRequests,
  });
}

export const orderLimiter = make(
  'order',
  15 * 60_000,
  8,
  'Too many orders from this device. Please call us instead.',
);
/** Only failed logins count, so the owner is never locked out by normal use. */
export const loginLimiter = make(
  'login',
  15 * 60_000,
  10,
  'Too many login attempts. Try again in 15 minutes.',
  true,
);
/**
 * Per-account lockout on top of the per-network limit, so guesses spread over many IPs still
 * stop after 10 failures per 15 minutes for one email address.
 */
export const loginAccountLimiter = make(
  'login-account',
  15 * 60_000,
  10,
  'Too many login attempts for this account. Try again in 15 minutes.',
  true,
  (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 200) : 'none';
  },
);
export const publicPostLimiter = make(
  'public',
  15 * 60_000,
  30,
  'Too many requests. Please slow down.',
);
