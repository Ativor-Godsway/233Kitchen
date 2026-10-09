import { SettingsModel, mergeSettings } from '../models/Settings.js';
import type { PublicSettings, Settings } from '../../shared/types.js';
import { env } from '../env.js';

export async function getSettings(): Promise<Settings> {
  const row = await SettingsModel.findById('global').lean();
  const s = mergeSettings(row?.data);
  // Never lose a new-order alert: fall back to OWNER_EMAIL (required in production).
  if (!s.notificationEmails.length && env.ownerEmail) s.notificationEmails = [env.ownerEmail];
  return s;
}

export async function saveSettings(next: Settings): Promise<Settings> {
  await SettingsModel.updateOne({ _id: 'global' }, { $set: { data: next } }, { upsert: true });
  return getSettings();
}

export function toPublicSettings(s: Settings): PublicSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notificationEmails, pickupAddressFull, ...rest } = s;
  return rest;
}
