/**
 * The only module that talks to an email provider.
 *  - RESEND_API_KEY set (default provider)  → Resend
 *  - EMAIL_PROVIDER=smtp                     → Nodemailer SMTP (e.g. Gmail app password)
 *  - neither, outside production             → printed to the console + HTML preview in ./.email-previews
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

type Provider = 'resend' | 'smtp' | 'dev' | 'none';

let warnedMissingSmtp = false;

export function activeProvider(): Provider {
  if (env.emailProvider === 'smtp') {
    if (env.smtp.user && env.smtp.pass) return 'smtp';
    if (!warnedMissingSmtp) {
      warnedMissingSmtp = true;
      console.warn(
        '[email] EMAIL_PROVIDER=smtp but SMTP_USER / SMTP_PASS are empty — real emails will NOT be sent.',
      );
    }
  }
  if (env.resendApiKey) return 'resend';
  return env.isProd ? 'none' : 'dev';
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

async function deliver(
  input: SendInput,
): Promise<{ status: EmailLogRow['status']; providerId: string | null }> {
  const provider = activeProvider();
  const replyTo = input.replyTo || env.emailReplyTo || undefined;

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
    let previewPath = '(preview not written)';
    if (!env.isTest) {
      const dir = path.resolve('.email-previews');
      mkdirSync(dir, { recursive: true });
      const safe = `${new Date().toISOString().replace(/[:.]/g, '-')}-${input.type}-${input.to.replace(/[^a-z0-9@.]/gi, '_')}.html`;
      previewPath = path.join(dir, safe);
      writeFileSync(previewPath, input.html);
      console.log(
        `\n📧 [dev email] ${input.type}\n   To: ${input.to}\n   Subject: ${input.subject}\n   HTML: ${previewPath}\n   ---- text ----\n${input.text
          .split('\n')
          .map((l) => `   ${l}`)
          .join('\n')}\n   --------------\n`,
      );
    }
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
