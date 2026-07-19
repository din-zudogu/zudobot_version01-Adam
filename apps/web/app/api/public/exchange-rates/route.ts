/**
 * GET /api/public/exchange-rates
 * Returns today's THB-based exchange rates. Cached 24h in MongoDB.
 * Used by the landing page pricing section to display localized prices.
 */
import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/fx/getExchangeRates";

export const dynamic = "force-dynamic";

export async function GET() {
  const rates = await getExchangeRates();
  return NextResponse.json(
    { ok: true, base: "THB", rates },
    {
      headers: {
        // Cache in browser for 1 hour; revalidate after that
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
