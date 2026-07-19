/**
 * GET /api/partner/analytics
 * Returns usage statistics for all tenants under this partner.
 * Partner sees: aggregate totals + per-tenant breakdown.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { UserModel } from "@/lib/db/models/User";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();

  // All subscriptions under this partner
  const subs = await SubscriptionModel
    .find({ referredByPartnerId: partnerId })
    .select("tenantId planId status partnerProvisioned totalThb")
    .lean();

  const tenantIds = subs.map((s) => s.tenantId);

  const [profiles, users] = await Promise.all([
    TenantProfileModel.find({ tenantId: { $in: tenantIds } })
      .select("tenantId businessName dailyMessageCount monthlyMessageCount totalMessageCount")
      .lean(),
    UserModel.find({ _id: { $in: tenantIds } })
      .select("_id email name botState")
      .lean(),
  ]);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));
  const userMap    = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  // Aggregate totals
  let totalDailyMessages   = 0;
  let totalMonthlyMessages = 0;
  let totalMessages        = 0;
  let activeCount          = 0;

  const tenants = subs.map((s) => {
    const profile = profileMap[s.tenantId];
    const user    = userMap[s.tenantId];
    const daily   = profile?.dailyMessageCount   ?? 0;
    const monthly = profile?.monthlyMessageCount ?? 0;
    const total   = profile?.totalMessageCount   ?? 0;

    totalDailyMessages   += daily;
    totalMonthlyMessages += monthly;
    totalMessages        += total;
    if (s.status === "active") activeCount++;

    return {
      tenantId:            s.tenantId,
      businessName:        profile?.businessName ?? user?.name ?? "—",
      email:               user?.email ?? "—",
      botState:            user?.botState ?? "unknown",
      planId:              s.planId,
      subStatus:           s.status,
      partnerProvisioned:  s.partnerProvisioned,
      dailyMessageCount:   daily,
      monthlyMessageCount: monthly,
      totalMessageCount:   total,
    };
  });

  // Sort by monthly messages desc
  tenants.sort((a, b) => b.monthlyMessageCount - a.monthlyMessageCount);

  return NextResponse.json({
    summary: {
      totalClients:        subs.length,
      activeClients:       activeCount,
      totalDailyMessages,
      totalMonthlyMessages,
      totalMessages,
    },
    tenants,
  });
}
