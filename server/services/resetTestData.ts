/**
 * Clears test data before go-live: orders, customers, email logs, campaigns and rate-limit
 * records, and resets the order counter so the next order is 233-0001. Menu items, settings and
 * admin users are never touched.
 *
 * Safety: counts first (dry run stops there), asks for confirmation, writes a JSON backup of
 * every document it will delete, and then deletes exactly the backed-up documents (anything
 * created in between is left alone).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import mongoose, { type Model } from 'mongoose';
import { OrderModel } from '../models/Order.js';
import { CustomerModel } from '../models/Customer.js';
import { EmailLogModel } from '../models/EmailLog.js';
import { CampaignModel } from '../models/Campaign.js';
import { RateLimitModel } from '../models/RateLimit.js';
import { CounterModel } from '../models/Counter.js';

const ORDER_COUNTER = 'order';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TARGETS: Array<{ name: string; model: Model<any> }> = [
  { name: 'orders', model: OrderModel },
  { name: 'customers', model: CustomerModel },
  { name: 'emaillogs', model: EmailLogModel },
  { name: 'campaigns', model: CampaignModel },
  { name: 'ratelimits', model: RateLimitModel },
];

export interface ResetOptions {
  dryRun?: boolean;
  /** Called after counting, before anything is written or deleted. Return true to proceed. */
  confirm: (info: {
    host: string;
    dbName: string;
    counts: Record<string, number>;
  }) => Promise<boolean>;
  /** Where backups/<timestamp>/ is created. Default: ./backups */
  backupRoot?: string;
  now?: Date;
}

export interface ResetResult {
  host: string;
  dbName: string;
  counts: Record<string, number>;
  status: 'dry-run' | 'cancelled' | 'done';
  backupDir?: string;
  deleted?: Record<string, number>;
  /** The next order number's sequence after the reset (1 → 233-0001). */
  nextOrderSeq?: number;
}

export function databaseInfo() {
  const c = mongoose.connection;
  return { host: c.host ?? 'unknown', dbName: c.name ?? 'unknown' };
}

export async function resetTestData(opts: ResetOptions): Promise<ResetResult> {
  const { host, dbName } = databaseInfo();
  const counts: Record<string, number> = {};
  for (const t of TARGETS) counts[t.name] = await t.model.countDocuments();
  const counter = await CounterModel.findById(ORDER_COUNTER).lean();
  counts['counters (order sequence)'] = counter ? 1 : 0;

  if (opts.dryRun) return { host, dbName, counts, status: 'dry-run' };
  if (!(await opts.confirm({ host, dbName, counts })))
    return { host, dbName, counts, status: 'cancelled' };

  // 1) Back up everything that will be deleted (Extended JSON keeps ObjectIds and dates exact).
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(opts.backupRoot ?? 'backups', stamp);
  mkdirSync(backupDir, { recursive: true });
  const { EJSON } = mongoose.mongo.BSON;
  const ids: Record<string, unknown[]> = {};
  for (const t of TARGETS) {
    const docs = await t.model.find().lean();
    ids[t.name] = docs.map((d) => d._id);
    writeFileSync(
      path.join(backupDir, `${t.name}.json`),
      EJSON.stringify(docs, undefined, 2, { relaxed: false }),
    );
  }
  writeFileSync(
    path.join(backupDir, 'counters.json'),
    EJSON.stringify(counter ? [counter] : [], undefined, 2, { relaxed: false }),
  );
  writeFileSync(
    path.join(backupDir, 'README.txt'),
    `Backup of ${dbName} on ${host}, taken by "npm run prod:reset-test-data" at ${stamp}.\n` +
      'Each file is a MongoDB Extended JSON array. Restore one with, e.g.:\n' +
      `  mongoimport --uri "$MONGODB_URI" --collection orders --jsonArray --file orders.json\n`,
  );

  // 2) Delete exactly what was backed up.
  const deleted: Record<string, number> = {};
  for (const t of TARGETS) {
    const r = await t.model.deleteMany({ _id: { $in: ids[t.name] } });
    deleted[t.name] = r.deletedCount;
  }

  // 3) Restart order numbers at 233-0001, unless orders arrived meanwhile (never reuse numbers).
  const newest = await OrderModel.findOne().sort({ seq: -1 }).select('seq').lean();
  const seq = newest?.seq ?? 0;
  await CounterModel.updateOne({ _id: ORDER_COUNTER }, { $set: { seq } }, { upsert: true });

  return { host, dbName, counts, status: 'done', backupDir, deleted, nextOrderSeq: seq + 1 };
}
