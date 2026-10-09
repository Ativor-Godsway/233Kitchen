import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AdminUserModel } from '../models/AdminUser.js';
import { MIN_ADMIN_PASSWORD } from './seed.js';

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export function validateAdminPassword(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD) return `Use at least ${MIN_ADMIN_PASSWORD} characters.`;
  if (password.length > 200) return 'Use at most 200 characters.';
  if (password.trim() !== password) return 'The password can’t start or end with a space.';
  return null;
}

/**
 * Creates an admin, or sets a new password for an existing one. Updating bumps tokenVersion, so
 * every existing session for that admin is signed out.
 */
export async function setAdmin(rawEmail: string, password: string) {
  const email = emailSchema.parse(rawEmail);
  const problem = validateAdminPassword(password);
  if (problem) throw new Error(problem);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await AdminUserModel.findOne({ email }).setOptions({ sanitizeFilter: true });
  if (existing) {
    existing.set({ passwordHash, tokenVersion: (existing.tokenVersion ?? 0) + 1 });
    await existing.save();
    return { email, created: false };
  }
  await AdminUserModel.create({ email, passwordHash });
  return { email, created: true };
}

export async function listAdmins() {
  const rows = await AdminUserModel.find().sort({ createdAt: 1 }).lean();
  return rows.map((a) => ({ email: a.email, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt }));
}

/** Removes an admin (and with it all their sessions). Refuses to remove the last one. */
export async function removeAdmin(rawEmail: string) {
  const email = emailSchema.parse(rawEmail);
  if ((await AdminUserModel.countDocuments()) <= 1)
    throw new Error('Refusing to remove the only admin. Add another admin first.');
  const r = await AdminUserModel.deleteOne({ email }).setOptions({ sanitizeFilter: true });
  if (!r.deletedCount) throw new Error(`No admin with email ${email}.`);
  return { email };
}
