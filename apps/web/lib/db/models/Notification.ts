import mongoose, { Schema, Document, Model } from "mongoose";

export type NotificationType =
  | "quota_alert_80"
  | "quota_alert_95"
  | "quota_exhausted"
  | "quota_suspended"
  | "trial_expiry_3days"
  | "trial_expired"
  | "payment_success"
  | "payment_failed"
  | "payment_grace"
  | "retention_warning"
  | "memory_warning"
  | "kyc_approved"
  | "kyc_rejected"
  | "plan_upgraded"
  | "system_announcement"
  | "promptpay_renewal_3days";

export interface INotification extends Document {
  tenantId:   string;
  type:       NotificationType;
  title:      string;
  message:    string;
  isRead:     boolean;
  actionUrl?: string;
  createdAt:  Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId:  { type: String, required: true, index: true },
    type:      { type: String, required: true },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    isRead:    { type: Boolean, default: false, index: true },
    actionUrl: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Composite index for fast unread queries
NotificationSchema.index({ tenantId: 1, isRead: 1, createdAt: -1 });

// Auto-delete notifications older than 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const NotificationModel: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);
