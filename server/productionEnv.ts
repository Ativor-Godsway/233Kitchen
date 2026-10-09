/**
 * Production start-up checks. In production (NODE_ENV=production or VERCEL=1) the API refuses to
 * run with missing or unsafe configuration instead of quietly degrading (no in-memory DB, no dev
 * secrets, no "pretend" email sending).
 */
import { env } from './env.js';
import { providerStatus } from './services/emailService.js';

const emailAddress = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

/** "mongodb+srv://u:p@host/k233?x=y" → "k233" (Mongo's default is "test"). */
export function dbNameFromUri(uri: string): string {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
  return decodeURIComponent(m?.[1] ?? '') || 'test';
}

/** Every problem with the current environment for a production run (empty = OK). */
export function productionEnvProblems(): string[] {
  const problems: string[] = [];
  const get = (k: string) => process.env[k]?.trim() ?? '';

  const uri = get('MONGODB_URI');
  if (!uri) problems.push('MONGODB_URI is not set');
  else if (!/^mongodb(\+srv)?:\/\//.test(uri))
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  else if (env.isPreview && !/preview/i.test(dbNameFromUri(uri)))
    problems.push(
      `Preview deployments must use a separate database whose name contains "preview" (got "${dbNameFromUri(uri)}"). Don't give Preview the production MONGODB_URI.`,
    );

  const secret = get('JWT_SECRET');
  if (!secret) problems.push('JWT_SECRET is not set');
  else if (secret.length < 32)
    problems.push('JWT_SECRET must be at least 32 characters (openssl rand -base64 48)');

  const site = get('SITE_URL');
  if (!site) problems.push('SITE_URL is not set');
  else if (!/^https:\/\/[^/]+/.test(site)) problems.push('SITE_URL must be an https:// URL');

  // Previews never send email (see emailService), so they need no email settings.
  if (env.isPreview) return problems;

  const email = providerStatus();
  if (email.misconfigured) problems.push(email.misconfigured);
  else if (email.provider !== 'smtp' && email.provider !== 'resend')
    problems.push(
      'No email provider configured (set EMAIL_PROVIDER=gmail with SMTP_USER + SMTP_PASS, or EMAIL_PROVIDER=resend with RESEND_API_KEY)',
    );
  if (!get('EMAIL_FROM')) problems.push('EMAIL_FROM is not set');
  else if (email.provider === 'smtp' && /gmail\.com$/i.test(env.smtp.host)) {
    if (emailAddress(get('EMAIL_FROM')) !== env.smtp.user.toLowerCase())
      problems.push('EMAIL_FROM must use the same address as SMTP_USER when sending through Gmail');
  }
  if (!get('OWNER_EMAIL')) problems.push('OWNER_EMAIL is not set (it receives new-order emails)');

  return problems;
}

/** Throws one clear error listing everything that is wrong. No-op outside production. */
export function assertProductionEnv(): void {
  if (!env.isProd) return;
  const problems = productionEnvProblems();
  if (problems.length) {
    throw new Error(
      `Refusing to start: production configuration is incomplete.\n  - ${problems.join('\n  - ')}\nSet these in Vercel → Settings → Environment Variables (Production) and redeploy.`,
    );
  }
}
