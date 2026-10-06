import mongoose from 'mongoose';
import { mkdirSync } from 'node:fs';
import { env } from './env.js';
import { seedDatabase } from './services/seed.js';

/**
 * Cached Mongoose connection. On Vercel each warm function instance reuses the
 * same connection instead of opening a new one per request.
 *
 * With no MONGODB_URI outside production, an in-memory MongoDB is started
 * (data persisted to ./.data/mongo in dev) and seeded automatically.
 */
interface Cache {
  promise: Promise<typeof mongoose> | null;
  memoryServer: { stop: () => Promise<boolean> } | null;
}

const g = globalThis as typeof globalThis & { __k233Mongo?: Cache };
const cache: Cache = (g.__k233Mongo ??= { promise: null, memoryServer: null });

mongoose.set('strictQuery', true);

async function startMemoryServer(): Promise<string> {
  // Indirect specifier so serverless bundlers never pull the dev-only package in.
  const pkg = 'mongodb-memory-server-core';
  const { MongoMemoryServer } = (await import(pkg)) as typeof import('mongodb-memory-server-core');
  const persist = !env.isTest;
  if (persist) mkdirSync('.data/mongo', { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: persist ? { dbPath: '.data/mongo', storageEngine: 'wiredTiger' } : {},
  });
  cache.memoryServer = server;
  return server.getUri('k233');
}

export function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (cache.promise) return cache.promise;

  cache.promise = (async () => {
    let uri = env.mongoUri;
    let autoSeed = false;
    if (!uri) {
      if (env.isProd) throw new Error('MONGODB_URI is required in production');
      uri = await startMemoryServer();
      autoSeed = true;
    }
    await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    });
    if (autoSeed) {
      const result = await seedDatabase({ adminEmail: env.adminEmail, adminPassword: env.adminPassword });
      if (!env.isTest) {
        console.log('\n  🗄️  Using in-memory MongoDB (no MONGODB_URI set). Data kept in ./.data/mongo');
        if (result.adminCreated || result.menuCreated) console.log('  🌱 Seeded:', JSON.stringify(result));
        console.log(`  🔑 Dev admin login: ${env.adminEmail} / ${env.adminPassword}  (dev only)\n`);
      }
    }
    return mongoose;
  })().catch((err) => {
    cache.promise = null;
    throw err;
  });
  return cache.promise;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  cache.promise = null;
  if (cache.memoryServer) {
    await cache.memoryServer.stop();
    cache.memoryServer = null;
  }
}
