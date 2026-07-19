import { NextResponse } from "next/server";
import { getCachedPublicPricing } from "@/lib/pricing/buildPublicPricing";

export const dynamic = "force-dynamic";

/** Public read-only pricing — values computed server-side from MasterPlanConfig (SSOT). */
export async function GET() {
  try {
    const snapshot = await getCachedPublicPricing();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[public/packages] read failed:", err);
    return NextResponse.json(
      { error: "pricing_unavailable" },
      { status: 503 }
    );
  }
}
