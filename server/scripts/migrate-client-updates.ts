/**
 * npm run migrate:client-updates
 *
 * Applies the Oct 2026 copy changes to an existing database (safe to run more than once):
 * the Loaded Hajia Waakye description and the exact pickup address in Settings.
 * Point MONGODB_URI at Atlas to update production.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import { migrateClientUpdates } from '../services/migrations.js';

async function main() {
  if (!env.mongoUri) console.warn('MONGODB_URI is empty: updating the local dev database only.');
  await connectDb();
  const result = await migrateClientUpdates();
  console.log('Migration complete:', result);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
