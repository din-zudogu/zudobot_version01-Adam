/**
 * GET /api/partner/clients/detail?tenantId=
 * Returns a single client's detail including current subscription — for buy-for-client page.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function GET(req: NextRequest) {
  const token    = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? "";
  if (!tenantId) return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();

  // Security: tenant must belong to this partner
  const sub = await SubscriptionModel.findOne({ tenantId, referredByPartnerId: partnerId })
    .select("planId status totalThb currentPeriodStart currentPeriodEnd memoryAddonId retentionAddonId partnerProvisioned")
    .lean();
  if (!sub) return NextResponse.json({ error: "not_owned" }, { status: 403 });

  const [user, profile] = await Promise.all([
    UserModel.findById(tenantId).select("name email botState").lean(),
    TenantProfileModel.findOne({ tenantId }).select("businessName").lean(),
  ]);

  return NextResponse.json({
    tenantId,
    name:         user?.name    ?? "",
    email:        user?.email   ?? "",
    businessName: profile?.businessName ?? "",
    botState:     user?.botState ?? "unknown",
    subscription: sub ? {
      planId:              sub.planId,
      status:              sub.status,
      totalThb:            sub.totalThb,
      currentPeriodStart:  sub.currentPeriodStart,
      currentPeriodEnd:    sub.currentPeriodEnd,
      memoryAddonId:       sub.memoryAddonId,
      retentionAddonId:    sub.retentionAddonId,
      partnerProvisioned:  sub.partnerProvisioned,
    } : null,
  });
}
