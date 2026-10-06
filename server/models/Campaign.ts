import mongoose, { Schema, Types } from 'mongoose';
import type { CampaignDTO, SegmentType } from '../../shared/types.js';

export interface CampaignRow {
  _id: Types.ObjectId;
  subject: string;
  heading: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  segment: SegmentType;
  tag: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: CampaignDTO['status'];
  isTransactional: boolean;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<CampaignRow>(
  {
    subject: { type: String, required: true },
    heading: { type: String, default: '' },
    body: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    ctaLabel: { type: String, default: '' },
    ctaUrl: { type: String, default: '' },
    segment: { type: String, required: true },
    tag: { type: String, default: '' },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: { type: String, default: 'sending' },
    isTransactional: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const CampaignModel =
  (mongoose.models.Campaign as mongoose.Model<CampaignRow>) ||
  mongoose.model<CampaignRow>('Campaign', campaignSchema);

export function toCampaignDTO(c: CampaignRow): CampaignDTO {
  return {
    id: c._id.toString(),
    subject: c.subject,
    heading: c.heading,
    body: c.body,
    imageUrl: c.imageUrl,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    segment: c.segment,
    tag: c.tag,
    recipientCount: c.recipientCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    status: c.status,
    isTransactional: c.isTransactional,
    sentAt: c.sentAt ? new Date(c.sentAt).toISOString() : null,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}
