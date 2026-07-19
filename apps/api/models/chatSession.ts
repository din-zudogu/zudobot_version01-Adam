import mongoose, { Schema, Document } from "mongoose";

interface IMessage {
  role: "user" | "model" | "admin";
  content: string;
  timestamp: Date;
}

export type BotStatus = "bot" | "handoff_pending" | "handoff_active" | "resolved" | "paused";

export interface IChatSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  sessionId: string;
  visitorId: string | null;
  messages: IMessage[];
  messageCount: number;
  sentiment: number; // Now 0-10 scale
  intent?: string; // Latest classified intent
  handoffRequested: boolean;
  botStatus: BotStatus;
  handoffAt?: Date;
  lastActiveAt: Date;
  // New fields for Phase 1
  alertCooldownUntil?: Date; // Cooldown for LINE Notify alerts
  intentLogs?: Array<{
    intent: string;
    confidence: number;
    timestamp: Date;
  }>; // Log of intent classifications
  // New fields for Phase 2
  pausedAt?: Date; // When bot was paused
  resumedAt?: Date; // When bot was resumed
  // New fields for Module 5: Audit trails
  auditTrail?: Array<{
    event: string; // 'pause', 'resume', 'handoff', 'alert_sent', 'config_change'
    details?: any; // Additional event data
    timestamp: Date;
    actor?: string; // 'system', 'admin', 'bot'
  }>;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    visitorId: { type: String, default: null },
    messages: [
      {
        role: { type: String, enum: ["user", "model", "admin"] },
        content: { type: String, maxlength: 4000 },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    messageCount: { type: Number, default: 0 },
    sentiment: { type: Number, default: 5, min: 0, max: 10 }, // Updated to 0-10 scale
    intent: { type: String, default: "unknown" }, // Latest intent
    handoffRequested: { type: Boolean, default: false },
    botStatus: { type: String, enum: ["bot", "handoff_pending", "handoff_active", "resolved", "paused"], default: "bot" },
    handoffAt: { type: Date },
    lastActiveAt: { type: Date, default: Date.now },
    // New fields for Phase 1
    alertCooldownUntil: { type: Date }, // Cooldown timestamp for alerts
    intentLogs: [{
      intent: { type: String, required: true },
      confidence: { type: Number, min: 0, max: 1, required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    // New fields for Phase 2
    pausedAt: { type: Date }, // When bot was paused
    resumedAt: { type: Date }, // When bot was resumed
    // New fields for Module 5: Audit trails
    auditTrail: [{
      event: { type: String, required: true },
      details: { type: Schema.Types.Mixed }, // Flexible object for event details
      timestamp: { type: Date, default: Date.now },
      actor: { type: String, default: "system" },
    }],
  },
  { timestamps: true }
);

// TTL: auto-delete sessions after 30 days of inactivity
chatSessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.models.ChatSession as mongoose.Model<IChatSession> ||
  mongoose.model<IChatSession>("ChatSession", chatSessionSchema);
