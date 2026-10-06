import mongoose, { Schema } from 'mongoose';

const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });

export const CounterModel =
  (mongoose.models.Counter as mongoose.Model<{ _id: string; seq: number }>) ||
  mongoose.model<{ _id: string; seq: number }>('Counter', counterSchema);

/** Atomically increments and returns the next value of a named sequence. */
export async function nextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}

/** 1 → "233-0001", 12345 → "233-12345" */
export function formatOrderNumber(seq: number): string {
  return `233-${String(seq).padStart(4, '0')}`;
}
