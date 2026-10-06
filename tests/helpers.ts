import { connectDb } from '../server/db.js';
import { OrderModel } from '../server/models/Order.js';
import { CustomerModel } from '../server/models/Customer.js';
import { CounterModel } from '../server/models/Counter.js';
import { EmailLogModel } from '../server/models/EmailLog.js';
import { SettingsModel } from '../server/models/Settings.js';
import { CampaignModel } from '../server/models/Campaign.js';
import { MenuItemModel } from '../server/models/MenuItem.js';
import { seedDatabase } from '../server/services/seed.js';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { openPickupDates } from '../shared/schedule.js';
import type { Settings } from '../shared/types.js';

export async function resetDb() {
  await connectDb();
  await Promise.all([
    OrderModel.deleteMany({}),
    CustomerModel.deleteMany({}),
    CounterModel.deleteMany({}),
    EmailLogModel.deleteMany({}),
    SettingsModel.deleteMany({}),
    CampaignModel.deleteMany({}),
    MenuItemModel.deleteMany({}),
  ]);
  await seedDatabase({
    adminEmail: process.env.ADMIN_EMAIL!,
    adminPassword: process.env.ADMIN_PASSWORD!,
  });
}

export async function patchSettings(patch: Partial<Settings>) {
  const row = await SettingsModel.findById('global').lean();
  await SettingsModel.updateOne(
    { _id: 'global' },
    { $set: { data: { ...(row?.data ?? {}), ...patch } } },
  );
}

export const nextOpenDate = () => openPickupDates(new Date(), DEFAULT_SETTINGS)[0];

export function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ama Mensah',
    phone: '508-555-0123',
    email: 'Ama@Example.com',
    pickupDate: nextOpenDate(),
    pickupWindowId: 'w14',
    fulfilment: 'pickup',
    notes: 'Extra napkins please',
    marketingConsent: true,
    website: '',
    items: [
      {
        slug: 'loaded-fried-rice-chicken',
        quantity: 2,
        selections: [{ groupKey: 'extras', optionKey: 'extra-plantain', qty: 1 }],
        notes: '',
      },
      {
        slug: 'ice-kenkey',
        quantity: 1,
        selections: [
          { groupKey: 'flavour', optionKey: 'oreo', qty: 1 },
          { groupKey: 'nuts', optionKey: 'with-nuts', qty: 1 },
        ],
      },
    ],
    ...overrides,
  };
}
