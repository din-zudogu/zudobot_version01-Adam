import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITenantProfile extends Document {
  tenantId: string;               // same as User._id.toString()
  // Step 1 — Business Info
  businessName: string;
  businessType: string;
  websiteUrl?: string;
  // Signup/onboarding — purpose + category master-data refs (Postgres UUIDs) + org info
  purposeId?: string;
  businessCategoryId?: string;
  orgName?: string;
  // Step 2 — Bot Setup
  botName: string;
  botGender: "female" | "male";
  botTone: "friendly" | "formal" | "playful";
  welcomeMessage: string;
  // Step 3 — Widget Config
  widgetColor: string;
  widgetPosition: "bottom-right" | "bottom-left";
  widgetEnabled: boolean;
  allowedDomain:  string;   // single allowed domain (1 slot = 1 domain)
  allowedDomains: string[]; // legacy
  // Quota alert deduplication
  quotaAlert80Sent:  boolean;
  quotaAlert95Sent:  boolean;
  // Monthly quota tracking (for paid plans on msgPerMonth)
  monthlyMessageCount:   number;
  monthlyMessageResetAt: Date;
  // Embed snippet info
  embedKey: string;               // public key for <script> tag
  // Step 4 — Trial
  trialStartedAt?: Date;
  // LINE Messaging API — per-tenant push notification (admin handoff)
  lineEnabled:        boolean;
  lineChannelSecret?: string;
  lineChannelToken?:  string;
  lineUserId?:        string;
  lineConnectCode?:   string;
  // LINE Omni-channel (mdw_omni_zdb_chat) — customer inbound webhook
  lineOmniEnabled:    boolean;
  lineLiffId?:        string;
  // Legacy LINE Notify (deprecated)
  lineNotifyEnabled: boolean;
  lineNotifyToken?:  string;
  // Meta (Facebook Messenger + Instagram) — mdw_omni_zdb_chat
  metaEnabled:           boolean;
  metaAppSecret?:        string;
  metaPageAccessToken?:  string;
  metaPageId?:           string;
  metaVerifyToken?:      string;
  // TikTok — mdw_omni_zdb_chat
  tiktokEnabled:         boolean;
  tiktokAccessToken?:    string;
  tiktokWebhookSecret?:  string;
  // Usage
  dailyMessageCount: number;
  dailyMessageResetAt: Date;
  totalMessageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const TenantProfileSchema = new Schema<ITenantProfile>(
  {
    tenantId:     { type: String, required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    businessType: { type: String, required: true },
    websiteUrl:   { type: String, trim: true },
    purposeId:          { type: String },
    businessCategoryId: { type: String },
    orgName:            { type: String, trim: true },
    botName:      { type: String, required: true, default: "Zudobot" },
    botGender:    { type: String, enum: ["female", "male"], default: "female" },
    botTone:      { type: String, enum: ["friendly","formal","playful"], default: "friendly" },
    welcomeMessage: { type: String, default: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ?" },
    widgetColor:    { type: String, default: "#1E5BC6" },
    widgetPosition: { type: String, enum: ["bottom-right","bottom-left"], default: "bottom-right" },
    widgetEnabled:  { type: Boolean, default: false },
    allowedDomain:     { type: String, default: "" },
    allowedDomains:    { type: [String], default: [] }, // legacy
    quotaAlert80Sent:  { type: Boolean, default: false },
    quotaAlert95Sent:  { type: Boolean, default: false },
    monthlyMessageCount:   { type: Number, default: 0 },
    monthlyMessageResetAt: { type: Date, default: () => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }},
    embedKey:          { type: String, required: true, unique: true },
    trialStartedAt:    { type: Date },
    // LINE Messaging API (admin handoff)
    lineEnabled:       { type: Boolean, default: false },
    lineChannelSecret: { type: String },
    lineChannelToken:  { type: String },
    lineUserId:        { type: String },
    lineConnectCode:   { type: String },
    // LINE Omni-channel (mdw_omni_zdb_chat)
    lineOmniEnabled:   { type: Boolean, default: false },
    lineLiffId:        { type: String },
    // Legacy LINE Notify (deprecated)
    lineNotifyEnabled: { type: Boolean, default: false },
    lineNotifyToken:   { type: String },
    // Meta (Facebook Messenger + Instagram)
    metaEnabled:          { type: Boolean, default: false },
    metaAppSecret:        { type: String },
    metaPageAccessToken:  { type: String },
    metaPageId:           { type: String },
    metaVerifyToken:      { type: String },
    // TikTok
    tiktokEnabled:        { type: Boolean, default: false },
    tiktokAccessToken:    { type: String },
    tiktokWebhookSecret:  { type: String },
    dailyMessageCount:   { type: Number, default: 0 },
    dailyMessageResetAt: { type: Date, default: () => new Date() },
    totalMessageCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const TenantProfileModel: Model<ITenantProfile> =
  mongoose.models.TenantProfile ??
  mongoose.model<ITenantProfile>("TenantProfile", TenantProfileSchema);
