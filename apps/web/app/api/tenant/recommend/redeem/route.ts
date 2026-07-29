import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import { getPointsBalance, getTierById, redeemTier } from "@/lib/db/referral";
import { applyRedemption } from "@/lib/referral/pointsEngine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  let body: { tierId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.tierId) {
    return NextResponse.json({ error: "missing_tier_id" }, { status: 400 });
  }

  try {
    await Promise.all([connectDB(), ensureReferralMasterData()]);

    const [user, tier] = await Promise.all([
      UserModel.findById(tenantId).select("createdAt"),
      getTierById(body.tierId),
    ]);
    if (!tier) {
      return NextResponse.json({ error: "tier_not_found" }, { status: 404 });
    }

    const { balance, cycleStart } = await getPointsBalance(tenantId, user?.createdAt ?? new Date());

    const result = applyRedemption(
      {
        id: tier.id,
        minPoints: tier.minPoints,
        maxPoints: tier.maxPoints,
        costPoints: tier.costPoints,
        bonusMsgPerMonth: tier.bonusMsgPerMonth,
        bonusRetentionDays: tier.bonusRetentionDays,
        bonusMemoryMb: tier.bonusMemoryMb,
        isActive: tier.isActive,
      },
      balance
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await redeemTier({
      tenantId,
      tierId: tier.id,
      pointsSpent: tier.costPoints,
      cycleStart,
    });

    return NextResponse.json({ ok: true, newBalance: result.newBalance });
  } catch (err) {
    console.error("[recommend-redeem] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
