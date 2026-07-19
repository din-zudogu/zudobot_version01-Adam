import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPlatformGlobalBotConfig extends Document {
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  avatarUrl: string;
  whitelistedDomains: string[];
  globalEmbedKey: string;
  updatedAt: Date;
}

const PlatformGlobalBotConfigSchema = new Schema<IPlatformGlobalBotConfig>(
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
    globalEmbedKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const PlatformGlobalBotConfigModel: Model<IPlatformGlobalBotConfig> =
  mongoose.models.PlatformGlobalBotConfig ??
  mongoose.model<IPlatformGlobalBotConfig>(
    "PlatformGlobalBotConfig",
    PlatformGlobalBotConfigSchema
  );
