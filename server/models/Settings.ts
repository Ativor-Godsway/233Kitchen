import mongoose, { Schema } from 'mongoose';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import type { Settings } from '../../shared/types.js';

/**
 * Single settings document (_id "global"). Stored as a flexible object and
 * always merged over DEFAULT_SETTINGS, so new settings get sensible defaults.
 */
const settingsSchema = new Schema(
  { _id: { type: String, default: 'global' }, data: { type: Schema.Types.Mixed, default: {} } },
  { timestamps: true, minimize: false },
);

type SettingsRow = { _id: string; data: Partial<Settings> };

export const SettingsModel =
  (mongoose.models.Settings as mongoose.Model<SettingsRow>) || mongoose.model<SettingsRow>('Settings', settingsSchema);

export function mergeSettings(data: Partial<Settings> | undefined): Settings {
  const d = data ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    social: { ...DEFAULT_SETTINGS.social, ...(d.social ?? {}) },
  };
}
