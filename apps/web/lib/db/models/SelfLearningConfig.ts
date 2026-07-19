/**
 * Singleton config document for the Self-Learning extraction schedule.
 * Only one document exists (upserted by key "global").
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISelfLearningConfig extends Document {
  key:          "global";           // singleton key
  enabled:      boolean;
  intervalHours: number;            // 1–24
  lookbackDays:  number;            // how many days of history to scan
  maxPerRun:     number;            // max examples to extract per run
  lastRunAt:     Date | null;
  nextRunAt:     Date | null;
  lastResult: {
    scanned:   number;
    extracted: number;
    skipped:   number;
    duplicate: number;
  } | null;
  updatedAt: Date;
}

const SelfLearningConfigSchema = new Schema<ISelfLearningConfig>(
  {
    key:           { type: String, default: "global", unique: true },
    enabled:       { type: Boolean, default: true },
    intervalHours: { type: Number, default: 8, min: 1, max: 24 },
    lookbackDays:  { type: Number, default: 30, min: 1, max: 30 },
    maxPerRun:     { type: Number, default: 50, min: 10, max: 200 },
    lastRunAt:     { type: Date, default: null },
    nextRunAt:     { type: Date, default: null },
    lastResult:    { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const SelfLearningConfigModel: Model<ISelfLearningConfig> =
  mongoose.models.SelfLearningConfig ??
  mongoose.model<ISelfLearningConfig>("SelfLearningConfig", SelfLearningConfigSchema);

/** Read or create the singleton config. */
export async function getSelfLearningConfig(): Promise<ISelfLearningConfig> {
  const cfg = await SelfLearningConfigModel.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return cfg!;
}
