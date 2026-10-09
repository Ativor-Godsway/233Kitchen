/**
 * Central, typed access to environment variables.
 * In production a missing secret is a hard error (see productionEnv.ts); dev-only fallbacks are
 * never used when NODE_ENV=production or VERCEL=1.
 */
import { existsSync, readFileSync } from 'node:fs';

/** Minimal .env loader for local dev (Vercel injects env vars itself). */
function loadDotEnv(): void {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
// Never load .env under tests: real SMTP/Resend credentials there would send real emails.
const underTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
if (!process.env.VERCEL && !underTest) loadDotEnv();

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const isTest = !isProd && (process.env.NODE_ENV === 'test' || !!process.env.VITEST);

/** Signs local dev sessions only. Production refuses to start without a real JWT_SECRET. */
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';

function required(name: string, devDefault: string): string {
  const v = process.env[name]?.trim();
  if (v) return v;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devDefault;
}

export const env = {
  isProd,
  isTest,
  get mongoUri() {
    return process.env.MONGODB_URI?.trim() ?? '';
  },
  get jwtSecret() {
    return required('JWT_SECRET', DEV_JWT_SECRET);
  },
  /** Only used by seeding. There are no defaults: see devDb.ts for the local dev login. */
  get adminEmail() {
    return process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  },
  get adminPassword() {
    return process.env.ADMIN_PASSWORD?.trim() ?? '';
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY?.trim() ?? '';
  },
  /** Explicit EMAIL_PROVIDER wins; otherwise SMTP is used whenever SMTP_USER + SMTP_PASS are set. */
  get emailProvider(): 'resend' | 'smtp' {
    const p = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
    if (p === 'smtp' || p === 'resend') return p;
    return process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim() ? 'smtp' : 'resend';
  },
  get emailFrom() {
    const from = process.env.EMAIL_FROM?.trim();
    if (from) return from;
    // Gmail only sends "From" the authenticated account, so default to it (dev convenience;
    // production requires EMAIL_FROM to be set explicitly).
    const smtpUser = process.env.SMTP_USER?.trim();
    return smtpUser ? `+233 Kitchen <${smtpUser}>` : '';
  },
  get emailReplyTo() {
    return process.env.EMAIL_REPLY_TO?.trim() ?? '';
  },
  get ownerEmail() {
    return process.env.OWNER_EMAIL?.trim().toLowerCase() || '';
  },
  smtp: {
    get host() {
      return process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    },
    get port() {
      return Number(process.env.SMTP_PORT || 465);
    },
    get user() {
      return process.env.SMTP_USER?.trim() ?? '';
    },
    get pass() {
      return process.env.SMTP_PASS?.trim() ?? '';
    },
  },
  get siteUrl() {
    return required('SITE_URL', 'http://localhost:5173').replace(/\/$/, '');
  },
  get tz() {
    return process.env.TZ_BUSINESS?.trim() || 'America/New_York';
  },
};
