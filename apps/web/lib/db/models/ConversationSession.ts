/**
 * ConversationSession — persisted chat memory per end-user session.
 *
 * Each document stores the full message history for one visitor session
 * on a tenant's website. sizeBytes tracks storage toward the tenant's
 * memoryMb plan limit.
 *
 * Cleanup strategy (two-layer):
 *   1. TTL index on expiresAt — MongoDB auto-deletes expired docs (≤60s lag)
 *   2. dailyCheck.cleanupExpiredSessions() — reports cleared count + sends warnings
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ChatMessage {
  role:      "user" | "model" | "admin";
  content:   string;
  timestamp: Date;
}

export type BotStatus = "bot" | "handoff_pending" | "handoff_active" | "resolved" | "paused";

export interface DeepLinkToken {
  token:     string;
  expiresAt: Date;
  usedAt?:   Date;
}

export interface IConversationSession extends Document {
  tenantId:         string;
  sessionId:        string;   // browser fingerprint / anonymous visitor ID
  endUserId?:       string;   // optional identified user
  messages:         ChatMessage[];
  sizeBytes:        number;   // JSON.stringify(messages).length (approx)
  createdAt:        Date;
  lastActiveAt:     Date;
  expiresAt:        Date;     // createdAt + retentionDays
  botStatus:        BotStatus;
  handoffRequested: boolean;
  handoffAt?:       Date;
  pausedAt?:        Date;
  deepLinkTokens:   DeepLinkToken[];
  consentGiven?:    boolean;
  consentAt?:       Date;
}

const MessageSchema = new Schema<ChatMessage>(
  { role: { type: String, enum: ["user", "model", "admin"], required: true },
    content:   { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const DeepLinkTokenSchema = new Schema<DeepLinkToken>(
  {
    token:     { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date },
  },
  { _id: false }
);

const ConversationSessionSchema = new Schema<IConversationSession>(
  {
    tenantId:         { type: String, required: true },
    sessionId:        { type: String, required: true },
    endUserId:        { type: String },
    messages:         { type: [MessageSchema], default: [] },
    sizeBytes:        { type: Number, default: 0 },
    lastActiveAt:     { type: Date, default: () => new Date() },
    expiresAt:        { type: Date, required: true },
    botStatus:        { type: String, enum: ["bot", "handoff_pending", "handoff_active", "resolved", "paused"], default: "bot" },
    handoffRequested: { type: Boolean, default: false },
    handoffAt:        { type: Date },
    pausedAt:         { type: Date },
    deepLinkTokens:   { type: [DeepLinkTokenSchema], default: [] },
    consentGiven:     { type: Boolean },
    consentAt:        { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ConversationSessionSchema.index({ tenantId: 1, sessionId: 1 }, { unique: true });
ConversationSessionSchema.index({ tenantId: 1, lastActiveAt: -1 });
ConversationSessionSchema.index({ tenantId: 1, expiresAt: 1 });
// Cross-session memory lookup by identified user (email / Line ID). Partial so
// it only covers the minority of sessions that have an endUserId — keeps the
// index small. Without this, getPastSessionSummaries() full-scans the tenant.
ConversationSessionSchema.index(
  { tenantId: 1, endUserId: 1 },
  { partialFilterExpression: { endUserId: { $exists: true } } },
);
// TTL — MongoDB deletes expired sessions automatically
ConversationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ConversationSessionModel: Model<IConversationSession> =
  mongoose.models.ConversationSession ??
  mongoose.model<IConversationSession>("ConversationSession", ConversationSessionSchema);
