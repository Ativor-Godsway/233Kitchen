import { MENU_SEED } from '../../shared/menu.seed.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { MenuItemModel } from '../models/MenuItem.js';
import { SettingsModel } from '../models/Settings.js';

const WAAKYE_SLUG = 'loaded-hajia-waakye';

/** Address fields the client asked to show in full (website, emails, calendar invite, CAN-SPAM line). */
const ADDRESS_KEYS = [
  'pickupAddressPublic',
  'mapQuery',
  'pickupAddressFull',
  'businessAddressLine',
] as const;

/**
 * Oct 2026 client updates for an existing database. Idempotent: running it again changes nothing.
 * - Loaded Hajia Waakye description from shared/menu.seed.ts ("talia" → "spaghetti")
 * - Exact pickup address in the global settings document
 */
export async function migrateClientUpdates() {
  const waakye = MENU_SEED.find((i) => i.slug === WAAKYE_SLUG);
  if (!waakye) throw new Error(`Seed item ${WAAKYE_SLUG} not found`);
  // Filters only match documents that still differ, so a rerun touches nothing (not even updatedAt).
  const menu = await MenuItemModel.updateOne(
    { slug: WAAKYE_SLUG, description: { $ne: waakye.description } },
    { $set: { description: waakye.description } },
  );

  const set = Object.fromEntries(ADDRESS_KEYS.map((k) => [`data.${k}`, DEFAULT_SETTINGS[k]]));
  // No settings document yet means DEFAULT_SETTINGS apply, which already hold the new address.
  const settings = await SettingsModel.updateOne(
    { _id: 'global', $or: Object.entries(set).map(([k, v]) => ({ [k]: { $ne: v } })) },
    { $set: set },
  );

  return {
    waakyeUpdated: menu.modifiedCount > 0,
    settingsUpdated: settings.modifiedCount > 0,
  };
}
