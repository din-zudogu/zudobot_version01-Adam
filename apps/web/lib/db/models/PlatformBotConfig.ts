import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPlatformBotConfig extends Document {
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  avatarUrl: string;
  whitelistedDomains: string[];
  embedKey: string;
  updatedAt: Date;
}

const PlatformBotConfigSchema = new Schema<IPlatformBotConfig>(
  {
    botName: { type: String, required: true, default: "Zudobot แอดมินหลัก" },
    welcomeMessage: {
      type: String,
      required: true,
      default: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
    },
    themeColor: { type: String, required: true, default: "#3B82F6" },
    avatarUrl: { type: String, default: "" },
    whitelistedDomains: { type: [String], default: [], index: true },
    embedKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const PlatformBotConfigModel: Model<IPlatformBotConfig> =
  mongoose.models.PlatformBotConfig ??
  mongoose.model<IPlatformBotConfig>("PlatformBotConfig", PlatformBotConfigSchema);
