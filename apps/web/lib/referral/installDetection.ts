import type { HydratedDocument } from "mongoose";
import type { ITenantProfile } from "@/lib/db/models/TenantProfile";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import {
  findPendingInviteForReferredTenant,
  markInviteInstalled,
  insertLedgerEntry,
  getActiveRuleConfig,
} from "@/lib/db/referral";
import { resolvePointsForEvent } from "@/lib/referral/pointsEngine";

/**
 * Called the first time /api/widget/init succeeds for a tenant from an
 * allowed domain — the strongest available signal that the widget is
 * genuinely live on the tenant's own website, i.e. "ติดตั้งสำเร็จ" for the
 * บอกต่อ (Recommend) referral program. Idempotent via
 * referral_invites.points_awarded / firstWidgetLoadAt.
 */
export async function markFirstWidgetLoadAndAwardReferral(profile: HydratedDocument<ITenantProfile>): Promise<void> {
  profile.firstWidgetLoadAt = new Date();
  await profile.save();

  await ensureReferralMasterData();
  const invite = await findPendingInviteForReferredTenant(profile.tenantId);
  if (!invite) return;

  const rules = await getActiveRuleConfig();
  const points = resolvePointsForEvent(rules, "referral", null, "signup");
  if (points == null) return;

  await markInviteInstalled(invite.id);
  await insertLedgerEntry({
    tenantId: invite.referrerTenantId,
    eventType: "referral",
    points,
    sourceRefId: invite.id,
    description: `เพื่อนที่แนะนำ (${invite.inviteeEmail}) ติดตั้ง ZUDOBOT สำเร็จ`,
  });
}
