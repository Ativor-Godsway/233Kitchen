/**
 * Vercel Serverless Function entry. vercel.json rewrites every /api/* request
 * here; Express then routes on the original URL.
 */
import app from '../server/app.js';

export default app;
