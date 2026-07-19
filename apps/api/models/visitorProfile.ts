import mongoose, { Schema, Document } from "mongoose";

// Auto-tags assigned by the system based on buying signals and behavior
export type VisitorTag =
  | "prospect"       // buying_intent detected
  | "hot_lead"       // checkout_ready detected
  | "price_shopper"  // price_inquiry detected
  | "comparison"     // comparison_shopping detected
  | "budget_sensitive"
  | "repeat_visitor" // ≥ 3 sessions
  | "handoff_requested"
  | "vip";           // manually set by merchant

export interface IVisitorProfile extends Document {
  tenantId: mongoose.Types.ObjectId;
  visitorId: string;
  tags: VisitorTag[];
  sessionCount: number;
  totalMessages: number;
  sentimentAvg: number;       // rolling average of session sentiment scores
  lastSentiment: number;
  handoffCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastMessage: string;        // last 200 chars of last user message
  notes: string;              // merchant can add free-text notes
}

const visitorProfileSchema = new Schema<IVisitorProfile>(
  {
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    visitorId:     { type: String, required: true },
    tags:          { type: [String], default: [] },
    sessionCount:  { type: Number, default: 1 },
    totalMessages: { type: Number, default: 0 },
    sentimentAvg:  { type: Number, default: 0 },
    lastSentiment: { type: Number, default: 0 },
    handoffCount:  { type: Number, default: 0 },
    firstSeenAt:   { type: Date, default: Date.now },
    lastSeenAt:    { type: Date, default: Date.now },
    lastMessage:   { type: String, default: "", maxlength: 200 },
    notes:         { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

visitorProfileSchema.index({ tenantId: 1, visitorId: 1 }, { unique: true });
visitorProfileSchema.index({ tenantId: 1, lastSeenAt: -1 });
visitorProfileSchema.index({ tenantId: 1, tags: 1 });

export default mongoose.models.VisitorProfile as mongoose.Model<IVisitorProfile> ||
  mongoose.model<IVisitorProfile>("VisitorProfile", visitorProfileSchema);
