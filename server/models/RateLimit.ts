import mongoose, { Schema } from 'mongoose';

/** Hit counters for express-rate-limit, shared by all serverless instances. TTL-expired by Mongo. */
const rateLimitSchema = new Schema({
  _id: { type: String, required: true },
  hits: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RateLimitModel =
  (mongoose.models.RateLimit as mongoose.Model<{ _id: string; hits: number; expiresAt: Date }>) ||
  mongoose.model<{ _id: string; hits: number; expiresAt: Date }>('RateLimit', rateLimitSchema);
