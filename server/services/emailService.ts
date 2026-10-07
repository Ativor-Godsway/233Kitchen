/**
 * The only module that talks to an email provider.
 *  - EMAIL_PROVIDER=smtp (or SMTP_USER + SMTP_PASS set)  → Nodemailer SMTP (e.g. Gmail app password)
 *  - EMAIL_PROVIDER=resend (or RESEND_API_KEY set)       → Resend
 *  - nothing configured, outside production              → console + HTML preview in ./.email-previews
 * A provider that is requested but missing credentials is never silently replaced: every
 * send logs a loud warning and is recorded as FAILED in EmailLog (resendable from the admin).
 * Every attempt is recorded in EmailLog; failures never throw to callers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';
import { EmailLogModel, type EmailLogRow } from '../models/EmailLog.js';
import type { EmailType } from '../../shared/types.js';

export interface SendInput {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  orderId?: string | Types.ObjectId | null;
  orderNumber?: string | null;
  campaignId?: string | Types.ObjectId | null;
}

export interface SendResult {
  ok: boolean;
  status: EmailLogRow['status'];
  logId: string;
  error?: string;
}

export type Provider = 'resend' | 'smtp' | 'dev' | 'none';

export interface ProviderStatus {
  /** What will actually happen on send. */
  provider: Provider;
  /** Set when a provider was requested (explicitly or by partial credentials) but can't be used. */
  misconfigured: string | null;
  /** Human label, e.g. "smtp (Gmail)". */
  label: string;
  from: string;
  ownerEmail: string;
}

/**
 * Resolves the provider from the live environment. Explicit EMAIL_PROVIDER always wins and is
 * never swapped for another provider; partial SMTP credentials count as "SMTP requested".
 */
export function providerStatus(): ProviderStatus {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const hasUser = !!env.smtp.user;
  const hasPass = !!env.smtp.pass;
  const smtpReady = hasUser && hasPass;
  const resendReady = !!env.resendApiKey;
  const fallback: Provider = env.isProd ? 'none' : 'dev';

  let provider: Provider;
  let misconfigured: string | null = null;
  if (explicit === 'smtp' || (!explicit && (hasUser || hasPass) && !resendReady)) {
    provider = smtpReady ? 'smtp' : fallback;
    if (!smtpReady) {
      const missing = [!hasUser && 'SMTP_USER', !hasPass && 'SMTP_PASS']
        .filter(Boolean)
        .join(' and ');
      misconfigured = `SMTP not configured (${missing} missing)`;
    }
  } else if (explicit === 'resend') {
    provider = resendReady ? 'resend' : fallback;
    if (!resendReady) misconfigured = 'Resend not configured (RESEND_API_KEY missing)';
  } else if (explicit && explicit !== 'smtp' && explicit !== 'resend') {
    provider = fallback;
    misconfigured = `Unknown EMAIL_PROVIDER "${explicit}" (use smtp or resend)`;
  } else {
    provider = smtpReady ? 'smtp' : resendReady ? 'resend' : fallback;
  }

  const smtpLabel = /gmail/i.test(env.smtp.host) ? 'smtp (Gmail)' : `smtp (${env.smtp.host})`;
  const label =
    provider === 'smtp'
      ? smtpLabel
      : provider === 'resend'
        ? 'resend'
        : provider === 'dev'
          ? 'dev (previews only, NOT sent)'
          : 'none (emails will FAIL)';
  return { provider, misconfigured, label, from: env.emailFrom, ownerEmail: env.ownerEmail };
}

export function activeProvider(): Provider {
  return providerStatus().provider;
}

/** One-line startup summary. Never includes passwords or API keys. */
export function describeEmailConfig(): string {
  const s = providerStatus();
  const owner = s.ownerEmail || `(OWNER_EMAIL not set; falls back to ${env.adminEmail})`;
  const line = `📧 Email: ${s.label} from ${s.from} → owner ${owner}`;
  return s.misconfigured
    ? `${line}
⚠️  ${s.misconfigured}. Emails will be logged as FAILED until fixed.`
    : line;
}

export function logEmailConfig(): void {
  const msg = describeEmailConfig();
  if (providerStatus().misconfigured) console.warn(msg);
  else console.log(msg);
}

let resend: Resend | null = null;
let smtp: Transporter | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`Email provider timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Dev only: print the email and save an HTML preview in ./.email-previews. */
function writePreview(input: SendInput): void {
  if (env.isTest || env.isProd) return;
  const dir = path.resolve('.email-previews');
  mkdirSync(dir, { recursive: true });
  const safe = `${new Date().toISOString().replace(/[:.]/g, '-')}-${input.type}-${input.to.replace(/[^a-z0-9@.]/gi, '_')}.html`;
  const previewPath = path.join(dir, safe);
  writeFileSync(previewPath, input.html);
  console.log(
    `\n📧 [dev email] ${input.type}\n   To: ${input.to}\n   Subject: ${input.subject}\n   HTML: ${previewPath}\n   ---- text ----\n${input.text
      .split('\n')
      .map((l) => `   ${l}`)
      .join('\n')}\n   --------------\n`,
  );
}

async function deliver(
  input: SendInput,
): Promise<{ status: EmailLogRow['status']; providerId: string | null }> {
  const status = providerStatus();
  const provider = status.provider;
  const replyTo = input.replyTo || env.emailReplyTo || undefined;

  if (status.misconfigured) {
    // Loud on EVERY attempt so it can't be missed in the terminal or Vercel logs.
    console.error(
      `\n⚠️  [email] ${status.misconfigured}: "${input.subject}" to ${input.to} was NOT sent.` +
        `\n    Fix the env vars and restart; then use Admin → Email log → Resend.\n`,
    );
    if (provider === 'dev') {
      writePreview(input);
      throw new Error(`${status.misconfigured}. Email saved as dev preview only.`);
    }
    throw new Error(`${status.misconfigured}. Email not sent.`);
  }

  if (provider === 'resend') {
    resend ??= new Resend(env.resendApiKey);
    const { data, error } = await withTimeout(
      resend.emails.send({
        from: env.emailFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo,
        headers: input.headers,
      }),
      12_000,
    );
    if (error) throw new Error(`${error.name}: ${error.message}`);
    return { status: 'sent', providerId: data?.id ?? null };
  }

  if (provider === 'smtp') {
    smtp ??= nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
    const info = await withTimeout(
      smtp.sendMail({
        from: env.emailFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo,
        headers: input.headers,
      }),
      15_000,
    );
    return { status: 'sent', providerId: info.messageId ?? null };
  }

  if (provider === 'dev') {
    writePreview(input);
    return { status: 'sent_dev', providerId: null };
  }

  throw new Error('Email is not configured (set RESEND_API_KEY or SMTP credentials).');
}

/** Sends one email straight through the provider (no EmailLog / DB needed). Used by `npm run email:test`. */
export async function sendTestEmail(to: string) {
  return deliver({
    type: 'owner_new_order',
    to,
    subject: '✅ +233 Kitchen — test email',
    html: '<p>If you can read this, real email sending from +233 Kitchen is working.</p>',
    text: 'If you can read this, real email sending from +233 Kitchen is working.',
  });
}

const oid = (v: string | Types.ObjectId | null | undefined) =>
  v ? new Types.ObjectId(String(v)) : null;

/** Sends an email and records the attempt. Never throws. */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  let status: EmailLogRow['status'] = 'failed';
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    ({ status, providerId } = await deliver(input));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`[email] ${input.type} to ${input.to} failed:`, error);
  }
  try {
    const log = await EmailLogModel.create({
      type: input.type,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      status,
      error,
      providerId,
      orderId: oid(input.orderId),
      orderNumber: input.orderNumber ?? null,
      campaignId: oid(input.campaignId),
    });
    return {
      ok: status !== 'failed',
      status,
      logId: log._id.toString(),
      ...(error ? { error } : {}),
    };
  } catch (e) {
    console.error('[email] could not write EmailLog', e);
    return { ok: status !== 'failed', status, logId: '', ...(error ? { error } : {}) };
  }
}

/** Re-sends a logged email (e.g. after a provider outage) and updates its log entry. */
export async function resendLoggedEmail(logId: string): Promise<SendResult | null> {
  const log = await EmailLogModel.findById(logId);
  if (!log) return null;
  try {
    const { status, providerId } = await deliver({
      type: log.type,
      to: log.to,
      subject: log.subject,
      html: log.html,
      text: log.text,
    });
    log.set({ status, providerId, error: null, attempts: (log.attempts ?? 1) + 1 });
    await log.save();
    return { ok: true, status, logId };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.set({ status: 'failed', error, attempts: (log.attempts ?? 1) + 1 });
    await log.save();
    return { ok: false, status: 'failed', logId, error };
  }
}
