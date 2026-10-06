/**
 * Central, typed access to environment variables.
 * In production a missing secret is a hard error; in dev we fall back to safe local defaults.
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
if (!process.env.VERCEL) loadDotEnv();

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

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
    return required('JWT_SECRET', 'dev-only-insecure-secret-change-me');
  },
  get adminEmail() {
    return (process.env.ADMIN_EMAIL?.trim() || 'admin@233kitchen.local').toLowerCase();
  },
  get adminPassword() {
    return process.env.ADMIN_PASSWORD?.trim() || 'admin1234';
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY?.trim() ?? '';
  },
  get emailProvider(): 'resend' | 'smtp' {
    return process.env.EMAIL_PROVIDER?.trim() === 'smtp' ? 'smtp' : 'resend';
  },
  get emailFrom() {
    return process.env.EMAIL_FROM?.trim() || '+233 Kitchen <onboarding@resend.dev>';
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
    return (process.env.SITE_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
  },
  get tz() {
    return process.env.TZ_BUSINESS?.trim() || 'America/New_York';
  },
};
