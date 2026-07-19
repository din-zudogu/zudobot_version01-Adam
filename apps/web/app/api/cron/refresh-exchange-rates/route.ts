/**
 * GET /api/cron/refresh-exchange-rates
 *
 * Called daily at 00:00 (midnight Bangkok time) by Amplify scheduler.
 * Fetches live THB exchange rates and refreshes the MongoDB cache.
 * Protected by INTERNAL_CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { refreshExchangeRates } from "@/lib/fx/getExchangeRates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = AMPLIFY_CONFIG.internalCronSecret;
  if (secret) {
    const auth = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (auth !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await refreshExchangeRates();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, base: "THB", count: Object.keys(result.rates ?? {}).length });
}
