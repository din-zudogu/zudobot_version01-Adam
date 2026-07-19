import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import {
  MasterPlanConfigModel,
  type IMasterPlanConfig,
} from "@/lib/db/models/MasterPlanConfig";
import { sanitizeMasterPlansForPublic } from "@/lib/pricing/sanitizeMasterPlansForPublic";
import { PUBLIC_PRICING_TAG, PARTNER_BENEFITS_TAG } from "@/lib/pricing/cacheTags";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

async function loadSanitizedPackages() {
  await connectDB();
  const plans = await MasterPlanConfigModel.find().lean<IMasterPlanConfig[]>();
  return sanitizeMasterPlansForPublic(plans);
}

const getCachedSanitizedPackages = unstable_cache(
  loadSanitizedPackages,
  ["public-pricing-api-sanitized"],
  { tags: [PUBLIC_PRICING_TAG, PARTNER_BENEFITS_TAG], revalidate: 3600 }
);

/** GET /api/public/pricing — sanitized Master Config (no internal costs) */
export async function GET() {
  try {
    const data = await getCachedSanitizedPackages();
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[Public Pricing API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
