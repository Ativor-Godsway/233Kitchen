import mongoose, { Schema, Types } from 'mongoose';
import type { EmailLogDTO, EmailType } from '../../shared/types.js';

export interface EmailLogRow {
  _id: Types.ObjectId;
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
  status: 'sent' | 'sent_dev' | 'failed';
  error: string | null;
  providerId: string | null;
  orderId: Types.ObjectId | null;
  orderNumber: string | null;
  campaignId: Types.ObjectId | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const emailLogSchema = new Schema<EmailLogRow>(
  {
    type: { type: String, required: true, index: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, default: '' },
    text: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'sent_dev', 'failed'], required: true, index: true },
    error: { type: String, default: null },
    providerId: { type: String, default: null },
    orderId: { type: Schema.Types.ObjectId, default: null, index: true },
    orderNumber: { type: String, default: null },
    campaignId: { type: Schema.Types.ObjectId, default: null, index: true },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: true },
);
emailLogSchema.index({ createdAt: -1 });

export const EmailLogModel =
  (mongoose.models.EmailLog as mongoose.Model<EmailLogRow>) || mongoose.model<EmailLogRow>('EmailLog', emailLogSchema);

export function toEmailLogDTO(e: EmailLogRow): EmailLogDTO {
  return {
    id: e._id.toString(),
    type: e.type,
    to: e.to,
    subject: e.subject,
    status: e.status,
    error: e.error ?? null,
    orderId: e.orderId ? e.orderId.toString() : null,
    orderNumber: e.orderNumber ?? null,
    campaignId: e.campaignId ? e.campaignId.toString() : null,
    createdAt: new Date(e.createdAt).toISOString(),
  };
}
