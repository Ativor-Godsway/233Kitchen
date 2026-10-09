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

export interface MenuMigrationResult {
  inserted: string[];
  updated: Array<{ slug: string; fields: string[] }>;
  unchanged: string[];
  /** Menu items in the database that aren't in the seed (left alone). */
  skipped: string[];
}

/** Items whose seed sortOrder is re-applied (Ice Kenkey moves to 5). */
const SORT_ORDER_SLUGS = new Set(['ice-kenkey']);

/**
 * Oct 2026 premium images + extras icons. Idempotent and menu-only (never touches orders,
 * customers or settings). Matches items by slug and options by group + option key.
 * - Inserts seed items that don't exist yet (Braised Rice Plate).
 * - image: set when empty or one of our own /images/… paths (keeps pasted https:// images).
 * - boxImages: filled in when empty.
 * - icon: filled in on options that have none.
 * - sortOrder: Ice Kenkey moves after the Braised Rice Plate.
 * Prices, names and descriptions the owner edited in admin are kept.
 */
export async function migrateMenuImagesIcons(): Promise<MenuMigrationResult> {
  const result: MenuMigrationResult = { inserted: [], updated: [], unchanged: [], skipped: [] };
  const seedSlugs = new Set(MENU_SEED.map((i) => i.slug));

  for (const seed of MENU_SEED) {
    const doc = await MenuItemModel.findOne({ slug: seed.slug }).lean();
    if (!doc) {
      await MenuItemModel.create(seed);
      result.inserted.push(seed.slug);
      continue;
    }

    const set: Record<string, unknown> = {};
    const ownImage = !doc.image || doc.image.startsWith('/images/');
    if (seed.image && ownImage && doc.image !== seed.image) set.image = seed.image;
    if (seed.boxImages?.length && !doc.boxImages?.length) set.boxImages = seed.boxImages;
    if (SORT_ORDER_SLUGS.has(seed.slug) && doc.sortOrder !== seed.sortOrder)
      set.sortOrder = seed.sortOrder;

    (doc.optionGroups ?? []).forEach((g, gi) => {
      const seedGroup = seed.optionGroups.find((sg) => sg.key === g.key);
      (g.options ?? []).forEach((o, oi) => {
        const icon = seedGroup?.options.find((so) => so.key === o.key)?.icon;
        if (icon && !o.icon) set[`optionGroups.${gi}.options.${oi}.icon`] = icon;
      });
    });

    const fields = Object.keys(set);
    if (!fields.length) {
      result.unchanged.push(seed.slug);
      continue;
    }
    await MenuItemModel.updateOne({ _id: doc._id }, { $set: set });
    result.updated.push({ slug: seed.slug, fields });
  }

  const others = await MenuItemModel.find({ slug: { $nin: [...seedSlugs] } })
    .select('slug')
    .lean();
  result.skipped = others.map((o) => o.slug);
  return result;
}
