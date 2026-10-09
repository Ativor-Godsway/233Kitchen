/**
 * npm run prod:reset-test-data -- --dry-run   → show what would be deleted, change nothing
 * npm run prod:reset-test-data                → back up to backups/<timestamp>/, then delete
 *
 * Deletes test orders, customers, email logs, campaigns and rate-limit records and restarts order
 * numbers at 233-0001. Keeps menu items, settings and admin users. Uses MONGODB_URI from the
 * environment (.env locally) and asks you to type the database name before changing anything.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import { formatOrderNumber } from '../models/Counter.js';
import { resetTestData } from '../services/resetTestData.js';
import { ask } from './prompt.js';

function printCounts(counts: Record<string, number>) {
  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(28)} ${n}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!env.mongoUri) throw new Error('MONGODB_URI is not set.');
  await connectDb();

  const result = await resetTestData({
    dryRun,
    confirm: async ({ host, dbName, counts }) => {
      console.log(`\nDatabase: ${dbName}\nHost:     ${host}\n\nWill back up and DELETE:`);
      printCounts(counts);
      console.log('\nKept: menu items, settings, admin users.');
      const typed = await ask(`\nType the database name (${dbName}) to continue: `);
      return typed === dbName;
    },
  });

  if (result.status === 'dry-run') {
    console.log(`\nDRY RUN on ${result.dbName} @ ${result.host}. Nothing was changed.`);
    console.log('Would back up and delete:');
    printCounts(result.counts);
    console.log('Kept: menu items, settings, admin users.');
  } else if (result.status === 'cancelled') {
    console.log('\nName did not match. Cancelled; nothing was changed.');
  } else {
    console.log(`\nBackup written to ${result.backupDir}`);
    console.log('Deleted:');
    printCounts(result.deleted!);
    console.log(`Next order number: ${formatOrderNumber(result.nextOrderSeq!)}`);
  }
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
