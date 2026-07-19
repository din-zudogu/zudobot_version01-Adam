import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnnouncement extends Document {
  title:          string;
  message:        string;
  actionUrl?:     string;
  createdBy:      string;
  recipientCount: number;
  createdAt:      Date;
  updatedAt:      Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title:          { type: String, required: true, trim: true },
    message:        { type: String, required: true, trim: true },
    actionUrl:      { type: String },
    createdBy:      { type: String, required: true },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AnnouncementModel: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
