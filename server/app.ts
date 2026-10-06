import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { connectDb } from './db.js';
import { errorHandler, HttpError } from './middleware/errors.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin/index.js';

/** The single Express app used by both `npm run dev` and the Vercel function. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.siteUrl, credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Ensure the (cached) DB connection before any data route.
  app.use('/api', (_req, _res, next) => {
    connectDb().then(() => next(), next);
  });

  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found', 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

export const app = createApp();
export default app;
