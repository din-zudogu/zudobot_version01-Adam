import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();
  const total = await SubscriptionModel.countDocuments({ referredByPartnerId: partnerId });
  const subs  = await SubscriptionModel
    .find({ referredByPartnerId: partnerId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const tenantIds = subs.map((s) => s.tenantId);
  const [users, profiles] = await Promise.all([
    UserModel.find({ _id: { $in: tenantIds } }).select("email name botState").lean(),
    TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName").lean(),
  ]);

  const userMap    = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));

  const clients = subs.map((s) => {
    const u = userMap[s.tenantId];
    const p = profileMap[s.tenantId];
    return {
      tenantId:     s.tenantId,
      email:        u?.email ?? "",
      name:         u?.name  ?? "",
      businessName: p?.businessName ?? "",
      botState:     u?.botState ?? "unknown",
      planId:       s.planId,
      subStatus:    s.status,
      totalThb:     s.totalThb,
      createdAt:    s.createdAt,
    };
  });

  return NextResponse.json({ clients, total, page, limit });
}
