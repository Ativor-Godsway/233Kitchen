import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { disconnectDb } from '../server/db.js';
import { providerStatus, sendEmail } from '../server/services/emailService.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { resetDb } from './helpers.js';

const KEYS = [
  'EMAIL_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'EMAIL_REPLY_TO',
  'RESEND_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(async () => {
  for (const k of KEYS) saved[k] = process.env[k];
  Object.assign(process.env, {
    EMAIL_PROVIDER: 'gmail',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'kitchen@gmail.com',
    SMTP_PASS: 'abcd efgh ijkl mnop',
    EMAIL_FROM: '+233 Kitchen <kitchen@gmail.com>',
    EMAIL_REPLY_TO: '',
    RESEND_API_KEY: '',
  });
  await resetDb();
});
afterEach(() => {
  for (const k of KEYS) process.env[k] = saved[k];
  vi.restoreAllMocks();
});
afterAll(disconnectDb);

describe('Gmail SMTP (env only)', () => {
  it('EMAIL_PROVIDER=gmail resolves to Gmail SMTP', () => {
    expect(providerStatus()).toMatchObject({
      provider: 'smtp',
      label: 'smtp (Gmail)',
      misconfigured: null,
      from: '+233 Kitchen <kitchen@gmail.com>',
    });
  });

  it('sends over implicit TLS with the app password, From = account, Reply-To = owner', async () => {
    const sendMail = vi.fn(async () => ({ messageId: '<id@gmail>' }));
    const create = vi
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);

    const r = await sendEmail({
      type: 'customer_order_received',
      to: 'customer@example.org',
      subject: 'We got your order',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(r).toMatchObject({ ok: true, status: 'sent' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'kitchen@gmail.com', pass: 'abcdefghijklmnop' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '+233 Kitchen <kitchen@gmail.com>',
        to: 'customer@example.org',
        replyTo: process.env.OWNER_EMAIL,
      }),
    );
    expect((await EmailLogModel.findOne().lean())?.providerId).toBe('<id@gmail>');
  });
});
