/**
 * Vercel Serverless Function entry. vercel.json rewrites every /api/* request
 * here; Express then routes on the original URL.
 */
import app from '../server/app.js';
import { assertProductionEnv } from '../server/productionEnv.js';
import { logEmailConfig } from '../server/services/emailService.js';

// Fail fast on a cold start with incomplete configuration: the error (listing every missing
// variable) is in Vercel → Logs, and no request is served with dev fallbacks.
assertProductionEnv();
// Logged once per cold start, visible in Vercel → Logs.
logEmailConfig();

export default app;
