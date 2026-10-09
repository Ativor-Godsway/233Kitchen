/**
 * npm run migrate:menu-images-icons
 *
 * Adds the premium images, "What you'll receive" box photos, extras icons and the Braised Rice
 * Plate to an existing menu (safe to run more than once; menu only). Owner-edited prices and
 * descriptions are kept. Point MONGODB_URI at Atlas to update production.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import { migrateMenuImagesIcons } from '../services/migrations.js';

async function main() {
  if (!env.mongoUri) console.warn('MONGODB_URI is empty: updating the local dev database only.');
  await connectDb();
  const r = await migrateMenuImagesIcons();
  console.log('Menu migration complete.');
  console.log(`  Inserted:  ${r.inserted.join(', ') || 'none'}`);
  if (r.updated.length) {
    console.log('  Updated:');
    for (const u of r.updated) console.log(`    ${u.slug}: ${u.fields.join(', ')}`);
  } else console.log('  Updated:   none');
  console.log(`  Unchanged: ${r.unchanged.join(', ') || 'none'}`);
  if (r.skipped.length) console.log(`  Not in seed (left alone): ${r.skipped.join(', ')}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
