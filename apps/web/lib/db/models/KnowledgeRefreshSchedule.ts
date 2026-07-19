/**
 * Per-tenant schedule for automatic Knowledge Base refresh.
 *
 * Each tenant can enable auto-refresh and pick an interval (e.g. every 6h).
 * A "refresh cycle" walks every knowledge source one at a time and is
 * RESUMABLE across cron ticks (so a large KB never exceeds the HTTP/Lambda
 * timeout): the `cycle` field stores the remaining queue + the current
 * source's progress cursor, persisted after every batch.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

/** In-progress refresh cycle. null when idle. */
export interface RefreshCycleState {
  startedAt: Date;
  queue:     string[];                          // sourceUrls not yet started
  current:   string | null;                     // sourceUrl currently processing
  phase:     "refetch" | "drain" | "reembed";   // refetch/drain = URL sources, reembed = file/custom
  cursor:    number;                            // offset within current source (reembed phase)
}

export interface RefreshResult {
  startedAt?:        Date;
  finishedAt?:       Date;
  urlsRefetched:     number;
  chunksReembedded:  number;
  sourcesCompleted:  number;
  failed:            number;
  errors:            string[];
}

export interface IKnowledgeRefreshSchedule extends Document {
  tenantId:      string;
  enabled:       boolean;
  intervalHours: number;                 // 2..168 (1 week)
  lastRunAt:     Date | null;            // when the last cycle STARTED
  nextRunAt:     Date | null;            // when the next cycle should start
  status:        "idle" | "running";
  cycle:         RefreshCycleState | null;
  lastResult:    RefreshResult | null;
  updatedAt:     Date;
}

const CycleSchema = new Schema<RefreshCycleState>(
  {
    startedAt: { type: Date,   required: true },
    queue:     { type: [String], default: [] },
    current:   { type: String, default: null },
    phase:     { type: String, enum: ["refetch", "drain", "reembed"], default: "refetch" },
    cursor:    { type: Number, default: 0 },
  },
  { _id: false },
);

const ResultSchema = new Schema<RefreshResult>(
  {
    startedAt:        { type: Date },
    finishedAt:       { type: Date },
    urlsRefetched:    { type: Number, default: 0 },
    chunksReembedded: { type: Number, default: 0 },
    sourcesCompleted: { type: Number, default: 0 },
    failed:           { type: Number, default: 0 },
    errors:           { type: [String], default: [] },
  },
  { _id: false },
);

const KnowledgeRefreshScheduleSchema = new Schema<IKnowledgeRefreshSchedule>(
  {
    tenantId:      { type: String, required: true, unique: true, index: true },
    enabled:       { type: Boolean, default: false },
    intervalHours: { type: Number, default: 6, min: 2, max: 168 },
    lastRunAt:     { type: Date, default: null },
    nextRunAt:     { type: Date, default: null },
    status:        { type: String, enum: ["idle", "running"], default: "idle" },
    cycle:         { type: CycleSchema, default: null },
    lastResult:    { type: ResultSchema, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const KnowledgeRefreshScheduleModel: Model<IKnowledgeRefreshSchedule> =
  mongoose.models.KnowledgeRefreshSchedule ??
  mongoose.model<IKnowledgeRefreshSchedule>("KnowledgeRefreshSchedule", KnowledgeRefreshScheduleSchema);

/** Read or create the per-tenant schedule (disabled by default). */
export async function getRefreshSchedule(tenantId: string): Promise<IKnowledgeRefreshSchedule> {
  const doc = await KnowledgeRefreshScheduleModel.findOneAndUpdate(
    { tenantId },
    { $setOnInsert: { tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc!;
}

/** Allowed interval presets (hours) surfaced in the dashboard UI. */
export const REFRESH_INTERVAL_PRESETS = [2, 6, 12, 24, 48, 168] as const;
