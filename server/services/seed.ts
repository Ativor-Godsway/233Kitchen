import bcrypt from 'bcryptjs';
import { MENU_SEED } from '../../shared/menu.seed.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { AdminUserModel } from '../models/AdminUser.js';
import { MenuItemModel } from '../models/MenuItem.js';
import { SettingsModel } from '../models/Settings.js';
import { env } from '../env.js';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  /** Overwrite existing menu items with the seed values. */
  resetMenu?: boolean;
  /** Reset the admin password if the admin already exists. */
  resetAdminPassword?: boolean;
}

/** Idempotent: only creates what is missing unless asked to reset. */
export async function seedDatabase(opts: SeedOptions) {
  const result = { menuCreated: 0, menuUpdated: 0, settingsCreated: false, adminCreated: false, adminPasswordReset: false };

  for (const item of MENU_SEED) {
    const existing = await MenuItemModel.findOne({ slug: item.slug });
    if (!existing) {
      await MenuItemModel.create(item);
      result.menuCreated++;
    } else if (opts.resetMenu) {
      existing.set(item);
      await existing.save();
      result.menuUpdated++;
    }
  }

  const settings = await SettingsModel.findById('global');
  if (!settings) {
    const notificationEmails = env.ownerEmail ? [env.ownerEmail] : [];
    await SettingsModel.create({
      _id: 'global',
      data: { ...DEFAULT_SETTINGS, timezone: env.tz, notificationEmails },
    });
    result.settingsCreated = true;
  }

  const email = opts.adminEmail.toLowerCase();
  const admin = await AdminUserModel.findOne({ email }).setOptions({ sanitizeFilter: true });
  if (!admin) {
    await AdminUserModel.create({ email, passwordHash: await bcrypt.hash(opts.adminPassword, 12) });
    result.adminCreated = true;
  } else if (opts.resetAdminPassword) {
    admin.set({ passwordHash: await bcrypt.hash(opts.adminPassword, 12), tokenVersion: (admin.tokenVersion ?? 0) + 1 });
    await admin.save();
    result.adminPasswordReset = true;
  }
  return result;
}
