import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";

/**
 * Returns packages available for partner resale.
 * Base plans: only those with partnerCost defined (not undefined).
 * Add-ons: all active ones (no restriction — pricing is fixed).
 */
export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await connectDB();

  const [basePlans, quotaAddons, memoryAddons, retentionAddons] = await Promise.all([
    PackageConfigModel.find({
      packageType:  "base",
      isActive:     true,
      isEnterprise: false,
      partnerCost:  { $exists: true, $ne: null },
    }).sort({ sortOrder: 1 }).lean(),
    PackageConfigModel.find({ packageType: "quota_addon",  isActive: true }).sort({ sortOrder: 1 }).lean(),
    PackageConfigModel.find({ packageType: "memory_addon", isActive: true }).sort({ sortOrder: 1 }).lean(),
    PackageConfigModel.find({ packageType: "retention_addon", isActive: true }).sort({ sortOrder: 1 }).lean(),
  ]);

  // Quota add-ons replace memory add-ons; legacy memory add-ons appended for backwards compat
  return NextResponse.json({ basePlans, memoryAddons: [...quotaAddons, ...memoryAddons], retentionAddons });
}
