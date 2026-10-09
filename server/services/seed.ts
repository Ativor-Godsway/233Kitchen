import bcrypt from 'bcryptjs';
import { MENU_SEED } from '../../shared/menu.seed.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { AdminUserModel } from '../models/AdminUser.js';
import { MenuItemModel } from '../models/MenuItem.js';
import { SettingsModel } from '../models/Settings.js';
import { env } from '../env.js';

export const MIN_ADMIN_PASSWORD = 10;

export interface SeedOptions {
  /** Admin to create if no admin with that email exists. Omit to leave admins alone. */
  admin?: { email: string; password: string };
  /**
   * Replace the existing menu and settings with the seed values. Without it, a database that
   * already has a menu or settings is never touched (the owner's edits are kept).
   */
  force?: boolean;
}

/** Idempotent: creates what is missing; overwrites menu/settings only with `force`. */
export async function seedDatabase(opts: SeedOptions = {}) {
  const result = {
    menuCreated: 0,
    menuUpdated: 0,
    menuSkipped: false,
    settingsCreated: false,
    settingsReset: false,
    adminCreated: false,
  };

  const hasMenu = (await MenuItemModel.estimatedDocumentCount()) > 0;
  if (hasMenu && !opts.force) {
    result.menuSkipped = true;
  } else {
    for (const item of MENU_SEED) {
      const existing = await MenuItemModel.findOne({ slug: item.slug });
      if (!existing) {
        await MenuItemModel.create(item);
        result.menuCreated++;
      } else {
        existing.set(item);
        await existing.save();
        result.menuUpdated++;
      }
    }
  }

  const settings = await SettingsModel.findById('global');
  if (!settings || opts.force) {
    const notificationEmails = [env.ownerEmail || opts.admin?.email.toLowerCase()].filter(
      (e): e is string => !!e,
    );
    await SettingsModel.updateOne(
      { _id: 'global' },
      { $set: { data: { ...DEFAULT_SETTINGS, timezone: env.tz, notificationEmails } } },
      { upsert: true },
    );
    if (settings) result.settingsReset = true;
    else result.settingsCreated = true;
  }

  if (opts.admin) {
    const email = opts.admin.email.trim().toLowerCase();
    if (!email || !opts.admin.password) throw new Error('Admin email and password are required');
    const exists = await AdminUserModel.exists({ email }).setOptions({ sanitizeFilter: true });
    if (!exists) {
      await AdminUserModel.create({
        email,
        passwordHash: await bcrypt.hash(opts.admin.password, 12),
      });
      result.adminCreated = true;
    }
  }
  return result;
}
