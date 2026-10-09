import mongoose from 'mongoose';

/** Port used by scripts/dev-db.ts for the local development database. */
export const DEV_DB_PORT = 27027;
export const DEV_DB_URI = `mongodb://127.0.0.1:${DEV_DB_PORT}/k233`;

/**
 * Login for the LOCAL dev database only (used when ADMIN_EMAIL / ADMIN_PASSWORD are not set).
 * db.ts never reaches this in production: there the in-memory/dev database is refused outright.
 */
export const DEV_ADMIN = { email: 'admin@233kitchen.local', password: 'admin1234' } as const;

/** Resolves true once the dev database accepts connections, false after `waitMs`. */
export async function waitForDevDb(waitMs: number): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  do {
    const conn = mongoose.createConnection(DEV_DB_URI, { serverSelectionTimeoutMS: 1000 });
    try {
      await conn.asPromise();
      await conn.close();
      return true;
    } catch {
      await conn.close().catch(() => undefined);
      if (Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
    }
  } while (Date.now() < deadline);
  return false;
}
