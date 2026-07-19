import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();
  const subs = await SubscriptionModel
    .find({ referredByPartnerId: partnerId, status: { $in: ["active", "past_due"] } })
    .lean();

  // Compute gross revenue (endUserPrice) and platform cost (partnerCost) per slot
  const planIds = Array.from(new Set(subs.map((s) => s.planId)));
  const packages = await PackageConfigModel.find({ packageId: { $in: planIds } }).lean();
  const pkgMap = Object.fromEntries(packages.map((p) => [p.packageId, p]));

  let totalGrossThb   = 0;
  let totalPlatformThb = 0;

  for (const sub of subs) {
    totalGrossThb    += sub.totalThb;
    const pkg = pkgMap[sub.planId];
    if (pkg?.partnerCost !== undefined) totalPlatformThb += pkg.partnerCost;
  }

  const totalNetThb    = totalGrossThb - totalPlatformThb;
  const activeSlots    = subs.length;
  const lifetimeEarningsThb = partner.totalEarningsThb;

  return NextResponse.json({
    activeSlots,
    totalGrossThb,
    totalPlatformThb,
    totalNetThb,
    lifetimeEarningsThb,
  });
}
