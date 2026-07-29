import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import {
  getPointsBalance,
  getActiveTiers,
  getActiveRedemption,
  listInvitesForReferrer,
} from "@/lib/db/referral";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  try {
    await Promise.all([connectDB(), ensureReferralMasterData()]);

    const user = await UserModel.findById(tenantId).select("createdAt");
    const signupDate = user?.createdAt ?? new Date();

    const [balanceInfo, tiers, activeRedemption, invites] = await Promise.all([
      getPointsBalance(tenantId, signupDate),
      getActiveTiers(),
      getActiveRedemption(tenantId),
      listInvitesForReferrer(tenantId),
    ]);

    const referredTenantIds = invites.map((i) => i.referredTenantId).filter((id): id is string => !!id);
    const profiles = referredTenantIds.length
      ? await TenantProfileModel.find({ tenantId: { $in: referredTenantIds } }).select("tenantId businessName")
      : [];
    const shopNameByTenantId = new Map(profiles.map((p) => [p.tenantId, p.businessName]));

    return NextResponse.json({
      balance: balanceInfo.balance,
      cycleStart: balanceInfo.cycleStart,
      cycleEnd: balanceInfo.cycleEnd,
      tiers: tiers.map((t) => ({
        id: t.id,
        minPoints: t.minPoints,
        maxPoints: t.maxPoints,
        costPoints: t.costPoints,
        bonusMsgPerMonth: t.bonusMsgPerMonth,
        bonusRetentionDays: t.bonusRetentionDays,
        bonusMemoryMb: t.bonusMemoryMb,
        label: t.label,
        eligible: balanceInfo.balance >= t.costPoints,
      })),
      activeRedemption: activeRedemption
        ? {
            tierId: activeRedemption.tier.id,
            label: activeRedemption.tier.label,
            pointsSpent: activeRedemption.redemption.pointsSpent,
            redeemedAt: activeRedemption.redemption.redeemedAt,
          }
        : null,
      invites: invites.map((inv) => ({
        id: inv.id,
        inviteeEmail: inv.inviteeEmail,
        shopName: inv.referredTenantId ? shopNameByTenantId.get(inv.referredTenantId) ?? null : null,
        status: inv.status,
        pointsAwarded: inv.pointsAwarded,
        createdAt: inv.createdAt,
        signedUpAt: inv.signedUpAt,
        installedAt: inv.installedAt,
      })),
    });
  } catch (err) {
    console.error("[recommend] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
