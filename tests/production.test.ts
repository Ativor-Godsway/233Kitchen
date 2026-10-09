import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { env } from '../server/env.js';
import { disconnectDb } from '../server/db.js';
import { assertProductionEnv, productionEnvProblems } from '../server/productionEnv.js';
import { seedDatabase } from '../server/services/seed.js';
import { sendEmail } from '../server/services/emailService.js';
import { MenuItemModel } from '../server/models/MenuItem.js';
import { SettingsModel } from '../server/models/Settings.js';
import { AdminUserModel } from '../server/models/AdminUser.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { resetDb } from './helpers.js';

const KEYS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'SITE_URL',
  'EMAIL_PROVIDER',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'OWNER_EMAIL',
] as const;
const saved: Record<string, string | undefined> = {};
const isProdDesc = Object.getOwnPropertyDescriptor(env, 'isProd')!;
const setProd = (on: boolean) =>
  Object.defineProperty(env, 'isProd', { value: on, configurable: true, enumerable: true });

const GOOD = {
  MONGODB_URI: 'mongodb+srv://u:p@cluster.example.net/k233',
  JWT_SECRET: 'x'.repeat(48),
  SITE_URL: 'https://233kitchen.example',
  EMAIL_PROVIDER: 'gmail',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_USER: 'kitchen@gmail.com',
  SMTP_PASS: 'abcd efgh ijkl mnop',
  RESEND_API_KEY: '',
  EMAIL_FROM: '+233 Kitchen <kitchen@gmail.com>',
  OWNER_EMAIL: 'kitchen@gmail.com',
};
const setEnv = (vars: Partial<Record<(typeof KEYS)[number], string>>) => {
  for (const k of KEYS) process.env[k] = vars[k] ?? '';
};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of KEYS) process.env[k] = saved[k];
  Object.defineProperty(env, 'isProd', isProdDesc);
  vi.restoreAllMocks();
});
afterAll(disconnectDb);

describe('production environment checks', () => {
  it('accepts a complete Gmail configuration', () => {
    setEnv(GOOD);
    expect(productionEnvProblems()).toEqual([]);
  });

  it('accepts a complete Resend configuration', () => {
    setEnv({
      ...GOOD,
      EMAIL_PROVIDER: 'resend',
      SMTP_USER: '',
      SMTP_PASS: '',
      RESEND_API_KEY: 're_123',
      EMAIL_FROM: '+233 Kitchen <orders@233kitchen.example>',
    });
    expect(productionEnvProblems()).toEqual([]);
  });

  it('lists every missing or unsafe setting', () => {
    setEnv({ JWT_SECRET: 'short', SITE_URL: 'http://insecure.example' });
    const problems = productionEnvProblems().join('\n');
    expect(problems).toMatch(/MONGODB_URI is not set/);
    expect(problems).toMatch(/JWT_SECRET must be at least 32 characters/);
    expect(problems).toMatch(/SITE_URL must be an https:\/\/ URL/);
    expect(problems).toMatch(/No email provider configured/);
    expect(problems).toMatch(/EMAIL_FROM is not set/);
    expect(problems).toMatch(/OWNER_EMAIL is not set/);
  });

  it('requires the Gmail From address to match SMTP_USER', () => {
    setEnv({ ...GOOD, EMAIL_FROM: '+233 Kitchen <orders@other.example>' });
    expect(productionEnvProblems()).toEqual([
      'EMAIL_FROM must use the same address as SMTP_USER when sending through Gmail',
    ]);
  });

  it('fails fast in production, and is a no-op in dev', () => {
    setEnv({});
    expect(() => assertProductionEnv()).not.toThrow();
    setProd(true);
    expect(() => assertProductionEnv()).toThrow(/Refusing to start[\s\S]*MONGODB_URI is not set/);
    setEnv(GOOD);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('never falls back to a default JWT secret or site URL in production', () => {
    setEnv({});
    setProd(true);
    // env.isProd is read at import for `required`, so check the module's own guard directly.
    expect(productionEnvProblems()).toContain('JWT_SECRET is not set');
    expect(productionEnvProblems()).toContain('SITE_URL is not set');
  });
});

describe('production email with no provider', () => {
  beforeEach(resetDb);

  it('records FAILED with a clear error and writes no preview', async () => {
    setProd(true);
    setEnv({});
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const before = existsSync('.email-previews') ? readdirSync('.email-previews').length : 0;
    const r = await sendEmail({
      type: 'owner_new_order',
      to: 'someone@example.org',
      subject: 'New order',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(r).toMatchObject({ ok: false, status: 'failed' });
    expect(r.error).toMatch(/not configured/i);
    expect((await EmailLogModel.findOne().lean())?.status).toBe('failed');
    expect(err).toHaveBeenCalled();
    const after = existsSync('.email-previews') ? readdirSync('.email-previews').length : 0;
    expect(after).toBe(before);
  });
});

describe('seedDatabase', () => {
  beforeEach(resetDb);

  it('never overwrites an existing menu or settings without force', async () => {
    await MenuItemModel.updateOne({ slug: 'ice-kenkey' }, { $set: { basePrice: 1 } });
    await MenuItemModel.deleteOne({ slug: 'loaded-hajia-waakye' });
    await SettingsModel.updateOne({ _id: 'global' }, { $set: { 'data.businessPhone': '1' } });
    const r = await seedDatabase();
    expect(r).toMatchObject({ menuSkipped: true, settingsCreated: false, settingsReset: false });
    expect((await MenuItemModel.findOne({ slug: 'ice-kenkey' }).lean())?.basePrice).toBe(1);
    // A dish the owner deleted is not brought back.
    expect(await MenuItemModel.exists({ slug: 'loaded-hajia-waakye' })).toBeNull();
    expect((await SettingsModel.findById('global').lean())?.data.businessPhone).toBe('1');
  });

  it('replaces menu and settings with force', async () => {
    await MenuItemModel.updateOne({ slug: 'ice-kenkey' }, { $set: { basePrice: 1 } });
    await SettingsModel.updateOne({ _id: 'global' }, { $set: { 'data.businessPhone': '1' } });
    const r = await seedDatabase({ force: true });
    expect(r.settingsReset).toBe(true);
    expect((await MenuItemModel.findOne({ slug: 'ice-kenkey' }).lean())?.basePrice).not.toBe(1);
    expect((await SettingsModel.findById('global').lean())?.data.businessPhone).not.toBe('1');
  });

  it('creates an admin only when given one, and never changes an existing admin', async () => {
    await AdminUserModel.deleteMany({});
    await seedDatabase();
    expect(await AdminUserModel.countDocuments()).toBe(0);
    await seedDatabase({ admin: { email: 'Owner@Example.org', password: 'first-password' } });
    const first = await AdminUserModel.findOne({ email: 'owner@example.org' }).lean();
    expect(first).toBeTruthy();
    await seedDatabase({ admin: { email: 'owner@example.org', password: 'second-password' } });
    const again = await AdminUserModel.findOne({ email: 'owner@example.org' }).lean();
    expect(again?.passwordHash).toBe(first?.passwordHash);
  });
});
