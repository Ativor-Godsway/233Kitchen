/**
 * npm run seed              → creates the menu and settings if the database has none
 * npm run seed -- --force   → REPLACES the menu and settings with the defaults in
 *                             shared/menu.seed.ts / shared/constants.ts (owner edits are lost)
 *
 * An admin is created only when BOTH ADMIN_EMAIL and ADMIN_PASSWORD are set (there are no
 * defaults), and an existing admin is never changed. To create or update an admin, or to
 * change a password, use `npm run admin:set -- --email <email>` instead.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import { MIN_ADMIN_PASSWORD, seedDatabase } from '../services/seed.js';

async function main() {
  const force = process.argv.includes('--force');
  const email = env.adminEmail;
  const password = env.adminPassword;
  if (!!email !== !!password) {
    throw new Error('Set BOTH ADMIN_EMAIL and ADMIN_PASSWORD to create an admin (or neither).');
  }
  if (password && password.length < MIN_ADMIN_PASSWORD) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters.`);
  }
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not set. (Local dev seeds itself automatically: npm run dev.)');
  }
  await connectDb();
  const result = await seedDatabase({
    admin: email ? { email, password } : undefined,
    force,
  });
  console.log('Seed complete:', result);
  if (result.menuSkipped)
    console.log('Menu already exists, left unchanged (use --force to replace it).');
  if (!email) console.log('No admin created. Use: npm run admin:set -- --email you@example.com');
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
