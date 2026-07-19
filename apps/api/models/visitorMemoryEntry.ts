import mongoose, { Schema, Document } from "mongoose";

// One entry = one session's worth of memory, summarized by Gemini and vector-embedded.
// Retrieved at chat time to give the bot persistent cross-session context.
export interface IVisitorMemoryEntry extends Document {
  tenantId: mongoose.Types.ObjectId;
  visitorId: string;
  sessionId: string;
  summary: string;       // Gemini-generated PII-scrubbed summary of the session
  embedding: number[];   // text-embedding-004 vector (768 dims)
  importance: number;    // 1–10, set by Gemini; used for LRU eviction (low = evict first)
  lastAccessedAt: Date;  // updated every time this memory is retrieved; drives LRU eviction
  embeddedAt: Date | null;
}

const visitorMemoryEntrySchema = new Schema<IVisitorMemoryEntry>(
  {
    tenantId:       { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    visitorId:      { type: String, required: true },
    sessionId:      { type: String, required: true },
    summary:        { type: String, required: true, maxlength: 1000 },
    embedding:      { type: [Number], default: [] },
    importance:     { type: Number, default: 5, min: 1, max: 10 },
    lastAccessedAt: { type: Date, default: Date.now },
    embeddedAt:     { type: Date, default: null },
  },
  { timestamps: true }
);

visitorMemoryEntrySchema.index({ tenantId: 1, visitorId: 1 });
visitorMemoryEntrySchema.index({ tenantId: 1, lastAccessedAt: 1 });
// LRU eviction index: find lowest importance + oldest lastAccessedAt
visitorMemoryEntrySchema.index({ tenantId: 1, importance: 1, lastAccessedAt: 1 });

export default mongoose.models.VisitorMemoryEntry as mongoose.Model<IVisitorMemoryEntry> ||
  mongoose.model<IVisitorMemoryEntry>("VisitorMemoryEntry", visitorMemoryEntrySchema);
