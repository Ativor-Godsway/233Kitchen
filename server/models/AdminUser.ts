import mongoose, { Schema, Types } from 'mongoose';

export interface AdminUserRow {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  /** Bumped on password change to invalidate existing sessions. */
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminUserSchema = new Schema<AdminUserRow>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const AdminUserModel =
  (mongoose.models.AdminUser as mongoose.Model<AdminUserRow>) ||
  mongoose.model<AdminUserRow>('AdminUser', adminUserSchema);
