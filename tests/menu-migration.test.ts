import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { disconnectDb } from '../server/db.js';
import { MenuItemModel } from '../server/models/MenuItem.js';
import { OrderModel } from '../server/models/Order.js';
import { CustomerModel } from '../server/models/Customer.js';
import { SettingsModel } from '../server/models/Settings.js';
import { migrateMenuImagesIcons } from '../server/services/migrations.js';
import { orderBody, resetDb } from './helpers.js';

/** Puts the menu back into its pre-October shape, as it is on Atlas today. */
async function legacyMenu() {
  await MenuItemModel.deleteOne({ slug: 'braised-rice-plate' });
  await MenuItemModel.updateMany(
    {},
    { $unset: { boxImages: 1, 'optionGroups.$[].options.$[].icon': 1 } },
  );
  await MenuItemModel.updateOne(
    { slug: 'loaded-hajia-waakye' },
    { $set: { image: '/images/waakye-meat-960.webp' } },
  );
  await MenuItemModel.updateOne({ slug: 'ice-kenkey' }, { $set: { image: null, sortOrder: 4 } });
  // Owner edits in admin that must survive.
  await MenuItemModel.updateOne(
    { slug: 'loaded-fried-rice-chicken' },
    {
      $set: {
        basePrice: 2200,
        description: 'Owner’s own words.',
        'optionGroups.0.options.0.price': 250,
      },
    },
  );
  await MenuItemModel.updateOne(
    { slug: 'banku-grilled-tilapia' },
    { $set: { image: 'https://cdn.example.com/banku.jpg' } },
  );
  await MenuItemModel.create({
    name: 'Kelewele',
    slug: 'kelewele',
    category: 'mains',
    basePrice: 800,
    sortOrder: 10,
  });
}

describe('migrate:menu-images-icons', () => {
  beforeEach(resetDb);
  afterAll(disconnectDb);

  it('fills images, box photos, icons and adds Braised Rice Plate; keeps owner edits', async () => {
    await legacyMenu();
    await request(app).post('/api/orders').send(orderBody()).expect(201);
    const before = {
      orders: await OrderModel.find().lean(),
      customers: await CustomerModel.find().lean(),
      settings: await SettingsModel.find().lean(),
    };

    const r = await migrateMenuImagesIcons();
    expect(r.inserted).toEqual(['braised-rice-plate']);
    expect(r.skipped).toEqual(['kelewele']);
    const fields = Object.fromEntries(r.updated.map((u) => [u.slug, u.fields]));
    expect(fields['loaded-hajia-waakye']).toEqual(
      expect.arrayContaining(['image', 'boxImages', 'optionGroups.0.options.0.icon']),
    );
    expect(fields['ice-kenkey']).toEqual(
      expect.arrayContaining(['image', 'sortOrder', 'optionGroups.1.options.0.icon']),
    );
    expect(fields['banku-grilled-tilapia']).not.toContain('image');

    const menu = (await request(app).get('/api/menu').expect(200)).body.items as Array<{
      slug: string;
      name: string;
      image: string;
      basePrice: number;
      description: string;
      sortOrder: number;
      boxImages: string[];
      optionGroups: Array<{ options: Array<{ key: string; price: number; icon?: string }> }>;
    }>;
    const by = Object.fromEntries(menu.map((m) => [m.slug, m]));
    expect(by['loaded-hajia-waakye'].image).toBe('/images/waakye-fish-960.webp');
    expect(by['loaded-hajia-waakye'].boxImages).toHaveLength(2);
    expect(by['ice-kenkey']).toMatchObject({ image: '/images/ice-kenkey-960.webp', sortOrder: 5 });
    expect(by['ice-kenkey'].optionGroups[0].options.map((o) => o.icon)).toEqual([
      'kenkey-oreo',
      'kenkey-caramel',
      'kenkey-strawberry',
      'kenkey-vanilla',
    ]);
    expect(by['braised-rice-plate']).toMatchObject({
      name: 'Braised Rice Plate',
      basePrice: 2000,
      sortOrder: 4,
      image: '/images/braised-rice-960.webp',
      boxImages: ['/images/box/braised-rice-480.webp'],
    });
    const rice = by['loaded-fried-rice-chicken'];
    expect(rice.basePrice).toBe(2200);
    expect(rice.description).toBe('Owner’s own words.');
    expect(rice.optionGroups[0].options[0]).toMatchObject({ price: 250, icon: 'shito' });
    expect(by['banku-grilled-tilapia'].image).toBe('https://cdn.example.com/banku.jpg');
    expect(menu.map((m) => m.slug)).toEqual([
      'loaded-fried-rice-chicken',
      'banku-grilled-tilapia',
      'loaded-hajia-waakye',
      'braised-rice-plate',
      'ice-kenkey',
      'kelewele',
    ]);

    // Orders, customers and settings are untouched.
    expect(await OrderModel.find().lean()).toEqual(before.orders);
    expect(await CustomerModel.find().lean()).toEqual(before.customers);
    expect(await SettingsModel.find().lean()).toEqual(before.settings);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await legacyMenu();
    await migrateMenuImagesIcons();
    const snapshot = await MenuItemModel.find().sort({ slug: 1 }).lean();
    const again = await migrateMenuImagesIcons();
    expect(again.inserted).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(await MenuItemModel.find().sort({ slug: 1 }).lean()).toEqual(snapshot);
  });

  it('does nothing on a freshly seeded database', async () => {
    const r = await migrateMenuImagesIcons();
    expect(r.inserted).toEqual([]);
    expect(r.updated).toEqual([]);
  });
});
