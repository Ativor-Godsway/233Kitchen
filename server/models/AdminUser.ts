import mongoose, { Schema } from 'mongoose';

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** Bumped on password change to invalidate existing sessions. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const AdminUserModel =
  mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
