/**
 * npm run seed            → creates menu, settings and admin user if missing
 * npm run seed -- --reset-menu            → also overwrite menu items with shared/menu.seed.ts
 * npm run seed -- --reset-admin-password  → set the admin password to ADMIN_PASSWORD
 *
 * Point MONGODB_URI at Atlas to seed production. ADMIN_EMAIL / ADMIN_PASSWORD are required then.
 */
import { env } from '../env.js';
import { connectDb, disconnectDb } from '../db.js';
import { seedDatabase } from '../services/seed.js';

async function main() {
  const args = new Set(process.argv.slice(2));
  if (env.mongoUri && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD when seeding a real database.');
  }
  if (env.mongoUri && env.adminPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters for a real database.');
  }
  await connectDb();
  const result = await seedDatabase({
    adminEmail: env.adminEmail,
    adminPassword: env.adminPassword,
    resetMenu: args.has('--reset-menu'),
    resetAdminPassword: args.has('--reset-admin-password'),
  });
  console.log('Seed complete:', result);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
