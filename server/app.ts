import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { API_CSP_DIRECTIVES } from './securityHeaders.js';
import { connectDb } from './db.js';
import { errorHandler, HttpError } from './middleware/errors.js';
import { describeError } from './logging.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin/index.js';

/** The single Express app used by both `npm run dev` and the Vercel function. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      // API responses are data, never pages. The website's own CSP is in vercel.json.
      contentSecurityPolicy: { useDefaults: false, directives: API_CSP_DIRECTIVES },
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  // Only the site itself may call the API from a browser.
  app.use(cors({ origin: env.siteUrl, credentials: true }));
  app.use(express.json({ limit: '100kb', strict: true }));
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
    connectDb().then(
      () => next(),
      (err) => {
        console.error(`[api] database unavailable: ${describeError(err)}`);
        next(
          new HttpError(503, 'Service is starting up. Please retry in a moment.', 'DB_UNAVAILABLE'),
        );
      },
    );
  });

  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found', 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

export const app = createApp();
export default app;
