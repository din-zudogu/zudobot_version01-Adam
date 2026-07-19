import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PricingRateMasterModel } from "@/lib/db/models/PricingRateMaster";
import { invalidatePricingRateCache } from "@/lib/pricing/getActivePricingRates";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST — atomically set one record as the active default ────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();

    // Verify the target record exists first
    const target = await PricingRateMasterModel.findById(id).lean();
    if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Atomic swap: clear all defaults → set this one
    await PricingRateMasterModel.updateMany({}, { $set: { isDefault: false } });
    const master = await PricingRateMasterModel.findByIdAndUpdate(
      id,
      { $set: { isDefault: true } },
      { new: true },
    ).lean();

    invalidatePricingRateCache();
    return NextResponse.json({ master, message: "default_updated" });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
