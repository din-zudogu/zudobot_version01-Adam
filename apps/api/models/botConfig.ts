import mongoose, { Schema, Document } from "mongoose";

interface DaySchedule {
  day: number;       // 0=Sun … 6=Sat
  open: string;      // "09:00"
  close: string;     // "21:00"
}

export interface IBotConfig extends Document {
  tenantId: mongoose.Types.ObjectId;
  // Persona
  botName: string;
  botAvatar: string;
  backstory: string;
  botIntro: string;
  toneOfVoice: "FRIENDLY" | "PROFESSIONAL" | "PLAYFUL";
  primaryLanguage: "th" | "en" | "both";
  customKnowledge: string;
  shippingPolicy: string;
  returnPolicy: string;
  // Sales config
  maxDiscountPercent: number;
  forbiddenTopics: string[];
  handoffMessage: string;
  // Quick replies
  quickReplies: string[];
  // UI
  themeColor: string;
  logoUrl: string;
  position: "bottom-right" | "bottom-left";
  autoOpenDelay: number;
  // Rate limit
  maxMessagesPerSession: number;
  // Operating hours
  operatingHours: {
    enabled: boolean;
    timezone: string;
    schedule: DaySchedule[];
    offlineMessage: string;
  };
}

const dayScheduleSchema = new Schema<DaySchedule>(
  { day: Number, open: String, close: String },
  { _id: false }
);

const botConfigSchema = new Schema<IBotConfig>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true, index: true },
    // Persona
    botName:         { type: String, default: "Zudobot" },
    botAvatar:       { type: String, default: "🤖" },
    backstory:       { type: String, default: "", maxlength: 1000 },
    botIntro:        { type: String, default: "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ? 😊" },
    toneOfVoice:     { type: String, enum: ["FRIENDLY","PROFESSIONAL","PLAYFUL"], default: "FRIENDLY" },
    primaryLanguage: { type: String, enum: ["th","en","both"], default: "th" },
    customKnowledge: { type: String, default: "", maxlength: 5000 },
    shippingPolicy:  { type: String, default: "" },
    returnPolicy:    { type: String, default: "" },
    // Sales
    maxDiscountPercent: { type: Number, default: 10, min: 0, max: 100 },
    forbiddenTopics:    { type: [String], default: [] },
    handoffMessage:     { type: String, default: "ขออภัยค่ะ ได้แจ้งทีมงานให้ติดต่อกลับโดยเร็วที่สุดเลยนะคะ 🙏" },
    // Quick replies
    quickReplies: { type: [String], default: [], validate: [(v: string[]) => v.length <= 5, "max 5 quick replies"] },
    // UI
    themeColor:    { type: String, default: "#6366f1" },
    logoUrl:       { type: String, default: "" },
    position:      { type: String, enum: ["bottom-right","bottom-left"], default: "bottom-right" },
    autoOpenDelay: { type: Number, default: 0, min: 0 },
    // Rate limit
    maxMessagesPerSession: { type: Number, default: 20, min: 1, max: 200 },
    // Operating hours
    operatingHours: {
      enabled:        { type: Boolean, default: false },
      timezone:       { type: String, default: "Asia/Bangkok" },
      schedule:       { type: [dayScheduleSchema], default: [] },
      offlineMessage: { type: String, default: "ขณะนี้ร้านปิดให้บริการแล้วค่ะ เปิดทำการวันพรุ่งนี้นะคะ 🙏" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.BotConfig as mongoose.Model<IBotConfig> ||
  mongoose.model<IBotConfig>("BotConfig", botConfigSchema);
