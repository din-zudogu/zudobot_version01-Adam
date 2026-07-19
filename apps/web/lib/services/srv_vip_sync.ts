/**
 * srv_vip_sync — VIP status synchronisation
 *
 * Called after any VipTenant create / update / delete so that the corresponding
 * User document always reflects the current VIP state:
 *   - Active VIP  → botState="active", isVip=true,  vipExpiresAt=endDate
 *   - No active VIP → isVip=false, vipExpiresAt cleared (botState untouched)
 *
 * Conditions for "active VIP":
 *   isActive=true  AND  startDate <= now  AND  endDate >= now
 */

import { VipTenantModel } from "@/lib/db/models/VipTenant";
import { UserModel } from "@/lib/db/models/User";

export interface VipSyncResult {
  email:         string;
  vipActive:     boolean;
  userFound:     boolean;
  userModified:  boolean;
}

/**
 * Recalculate and apply VIP status for a single email address.
 * Caller must have already called connectDB() before invoking this.
 */
export async function syncVipStatus(email: string): Promise<VipSyncResult> {
  const now        = new Date();
  const lowerEmail = email.toLowerCase();

  // Latest active, non-expired VIP record for this email
  const activeVip = await VipTenantModel.findOne({
    email:     lowerEmail,
    isActive:  true,
    startDate: { $lte: now },
    endDate:   { $gte: now },
  })
    .sort({ endDate: -1 })
    .select("endDate")
    .lean() as { endDate: Date } | null;

  let userModified = false;
  let userFound    = false;

  if (activeVip) {
    const res = await UserModel.updateOne(
      { email: lowerEmail },
      { $set: { botState: "active", isVip: true, vipExpiresAt: activeVip.endDate } },
    );
    userFound    = res.matchedCount > 0;
    userModified = res.modifiedCount > 0;
  } else {
    const res = await UserModel.updateOne(
      { email: lowerEmail },
      { $set: { isVip: false }, $unset: { vipExpiresAt: "" } },
    );
    userFound    = res.matchedCount > 0;
    userModified = res.modifiedCount > 0;
  }

  return {
    email:        lowerEmail,
    vipActive:    !!activeVip,
    userFound,
    userModified,
  };
}

/**
 * Expire all VipTenant records whose endDate has passed and isActive is still true,
 * then re-sync every affected email.
 * Returns the list of expired records' emails.
 */
export async function expireAndSyncVipTenants(): Promise<string[]> {
  const now = new Date();

  // Find VIP records that are still marked active but have expired
  const expired = await VipTenantModel.find({
    isActive: true,
    endDate:  { $lt: now },
  })
    .select("email")
    .lean() as { email: string }[];

  if (expired.length > 0) {
    await VipTenantModel.updateMany(
      { isActive: true, endDate: { $lt: now } },
      { $set: { isActive: false } },
    );
  }

  const expiredEmails = Array.from(new Set(expired.map((v) => v.email)));
  for (const email of expiredEmails) {
    await syncVipStatus(email);
  }

  return expiredEmails;
}
