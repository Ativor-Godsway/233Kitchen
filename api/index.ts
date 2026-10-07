/**
 * Vercel Serverless Function entry. vercel.json rewrites every /api/* request
 * here; Express then routes on the original URL.
 */
import app from '../server/app.js';
import { logEmailConfig } from '../server/services/emailService.js';

// Logged once per cold start, visible in Vercel → Logs.
logEmailConfig();

export default app;
