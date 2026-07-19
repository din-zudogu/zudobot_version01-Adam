import mongoose, { Schema, Document } from "mongoose";

export type BotStatus = "bot" | "handoff_pending" | "handoff_active" | "resolved";

interface IMessage {
  role: "user" | "model" | "admin";
  content: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  sessionId: string;
  visitorId: string | null;
  messages: IMessage[];
  messageCount: number;
  sentiment: number;
  handoffRequested: boolean;
  botStatus: BotStatus;
  handoffAt?: Date;
  lastActiveAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    tenantId:         { type: Schema.Types.ObjectId, ref: "Tenant" },
    sessionId:        { type: String, index: true },
    visitorId:        { type: String, default: null },
    messages: [
      {
        role:      { type: String, enum: ["user", "model", "admin"] },
        content:   { type: String, maxlength: 4000 },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    messageCount:     { type: Number, default: 0 },
    sentiment:        { type: Number, default: 0 },
    handoffRequested: { type: Boolean, default: false },
    botStatus: {
      type:    String,
      enum:    ["bot", "handoff_pending", "handoff_active", "resolved"],
      default: "bot",
    },
    handoffAt:    { type: Date },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", chatSessionSchema);
