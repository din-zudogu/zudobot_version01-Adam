import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { dailyCapForPlan, monthlyCapForPlan, type PlanId } from "@/lib/payment/pmRules";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [user, profile, sub, sessionCount] = await Promise.all([
      UserModel.findById(token.sub).select("botState trialEndsAt createdAt").lean(),
      TenantProfileModel.findOne({ tenantId: token.sub }).lean(),
      SubscriptionModel.findOne({ tenantId: token.sub }).lean(),
      ConversationSessionModel.countDocuments({ tenantId: token.sub }),
    ]);

    const planId = (sub?.planId as PlanId) ?? "trial";
    const dailyQuota   = dailyCapForPlan(planId);
    const monthlyQuota = monthlyCapForPlan(planId);
    const isMonthly    = monthlyQuota >= 0 || planId === "enterprise";
    const dailyUsed    = profile?.dailyMessageCount   ?? 0;
    const monthlyUsed  = profile?.monthlyMessageCount ?? 0;
    const activeQuota  = isMonthly ? monthlyQuota : dailyQuota;
    const activeUsed   = isMonthly ? monthlyUsed  : dailyUsed;
    const pct = activeQuota > 0 ? Math.min(100, Math.round((activeUsed / activeQuota) * 100)) : 0;

    // Average messages per day since account creation
    const memberSince = user?.createdAt ?? new Date();
    const daysSince   = Math.max(1, Math.floor((Date.now() - new Date(memberSince).getTime()) / 86_400_000));
    const totalMessages = profile?.totalMessageCount ?? 0;
    const avgPerDay     = Math.round(totalMessages / daysSince);

    // Plan label
    let planLabel: string = planId;
    const planPkg = await PackageConfigModel.findOne({ packageId: planId }).lean();
    if (planPkg?.label) planLabel = planPkg.label;

    return NextResponse.json({
      dailyUsed,
      dailyQuota,
      monthlyUsed,
      monthlyQuota,
      isMonthly,
      quotaUsed:    activeUsed,
      quotaCap:     activeQuota,
      dailyPct:     pct,
      totalMessages,
      avgPerDay,
      activeSessions: sessionCount,
      memberSince,
      botState: user?.botState,
      planId,
      planLabel,
      dailyResetAt:   profile?.dailyMessageResetAt,
      monthlyResetAt: profile?.monthlyMessageResetAt,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
