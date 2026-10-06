/**
 * Long-lived local MongoDB for `npm run dev` when MONGODB_URI is empty.
 * Runs separately from the API so API hot-reloads never restart the database.
 * Data persists in ./.data/mongo. Delete that folder to start fresh.
 */
import { mkdirSync } from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { DEV_DB_PORT } from '../server/devDb.js';
import { env } from '../server/env.js';

if (env.mongoUri) {
  console.log(
    '  🗄️  MONGODB_URI is set, so the API uses that database (local dev DB not started).',
  );
  // Stay alive so `concurrently -k` keeps the other processes running.
  setInterval(() => undefined, 1 << 30);
} else {
  await startLocal();
}

async function startLocal() {
  mkdirSync('.data/mongo', { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: DEV_DB_PORT, dbPath: '.data/mongo', storageEngine: 'wiredTiger' },
  });
  console.log(`  🗄️  Local dev MongoDB ready at ${server.getUri()} (data in ./.data/mongo)`);

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
