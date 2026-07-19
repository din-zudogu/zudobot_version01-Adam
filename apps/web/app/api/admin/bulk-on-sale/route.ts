import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

/** POST — set isActive=true, isOnSale=true on every ReadyPackage and CostPriceScenario (super_admin) */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const [pkgResult, scenResult] = await Promise.all([
      ReadyPackageModel.updateMany({}, { $set: { isActive: true, isOnSale: true } }),
      CostPriceScenarioModel.updateMany({}, { $set: { isActive: true, isOnSale: true } }),
    ]);

    invalidatePublicPricingCache();

    return NextResponse.json({
      ok: true,
      updated: {
        readyPackages: pkgResult.modifiedCount,
        costPriceScenarios: scenResult.modifiedCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
