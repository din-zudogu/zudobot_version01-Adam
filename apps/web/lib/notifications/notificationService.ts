import { NotificationModel, type NotificationType } from "@/lib/db/models/Notification";

export async function createNotification(
  tenantId:   string,
  type:       NotificationType,
  title:      string,
  message:    string,
  actionUrl?: string,
): Promise<void> {
  await NotificationModel.create({ tenantId, type, title, message, actionUrl });
}

/** Returns true if a notification of this type was already created today (UTC midnight) */
export async function notificationSentToday(
  tenantId: string,
  type:     NotificationType,
): Promise<boolean> {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const existing = await NotificationModel.findOne({
    tenantId,
    type,
    createdAt: { $gte: midnight },
  });
  return !!existing;
}
