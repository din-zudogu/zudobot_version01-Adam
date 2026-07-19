import mongoose, { Document, Model, Schema } from "mongoose";

export type PlatformName = "line" | "facebook" | "instagram" | "tiktok";

export interface IChannelContextToken extends Document {
  token:          string;
  tenantId:       string;
  embedKey:       string;
  platformUserId: string;
  platformName:   PlatformName;
  initialMessage: string;
  displayName?:   string;
  expiresAt:      Date;
}

const ChannelContextTokenSchema = new Schema<IChannelContextToken>({
  token:          { type: String, required: true, unique: true, index: true },
  tenantId:       { type: String, required: true, index: true },
  embedKey:       { type: String, required: true },
  platformUserId: { type: String, required: true },
  platformName:   { type: String, required: true, enum: ["line","facebook","instagram","tiktok"] },
  initialMessage: { type: String, required: true },
  displayName:    { type: String },
  expiresAt:      { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const ChannelContextTokenModel: Model<IChannelContextToken> =
  mongoose.models.ChannelContextToken ??
  mongoose.model<IChannelContextToken>("ChannelContextToken", ChannelContextTokenSchema);
