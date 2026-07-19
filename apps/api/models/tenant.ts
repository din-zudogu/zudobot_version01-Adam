import mongoose, { Schema, Document } from "mongoose";

export interface ITenant extends Document {
  name: string;
  publicKey: string;        // x-api-key (frontend widget)
  secretKey: string;        // x-secret-key (server-to-server)
  allowedDomain:  string;   // single allowed domain (1 slot = 1 domain)
  allowedDomains: string[]; // legacy — kept for backward compat during migration
  plan: "trial" | "starter" | "pro" | "enterprise";
  expiryDate: Date | null;
  isActive: boolean;
  // LINE Messaging API — per-tenant push notification
  lineEnabled:       boolean;
  lineChannelSecret: string;  // for webhook signature verification
  lineChannelToken:  string;  // Channel Access Token (long-lived)
  lineUserId:        string;  // captured via webhook (source.userId)
  lineConnectCode:   string;  // temp code shown in dashboard for pairing
  // Legacy LINE Notify (deprecated — kept for safe migration)
  lineNotifyToken:   string;
  lineNotifyEnabled: boolean;
  createdAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name:           { type: String, required: true },
    publicKey:      { type: String, required: true, unique: true, index: true },
    secretKey:      { type: String, required: true, unique: true, index: true },
    allowedDomain:  { type: String, default: "" },
    allowedDomains: { type: [String], default: [] }, // legacy
    plan:           { type: String, enum: ["trial", "starter", "pro", "enterprise"], default: "trial" },
    expiryDate:     { type: Date, default: null },
    isActive:       { type: Boolean, default: true },
    // LINE Messaging API
    lineEnabled:       { type: Boolean, default: false },
    lineChannelSecret: { type: String, default: "" },
    lineChannelToken:  { type: String, default: "" },
    lineUserId:        { type: String, default: "" },
    lineConnectCode:   { type: String, default: "" },
    // Legacy (deprecated)
    lineNotifyToken:   { type: String, default: "" },
    lineNotifyEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Tenant as mongoose.Model<ITenant> ||
  mongoose.model<ITenant>("Tenant", tenantSchema);
