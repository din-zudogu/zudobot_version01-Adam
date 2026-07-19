import { NextRequest, NextResponse } from "next/server";
import { runDailyCheck } from "@/lib/payment/dailyCheck";

// Called by AWS Amplify Scheduled Function (internal) or admin manually.
// Protected by a shared secret — not exposed to public.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected   = `Bearer ${process.env.INTERNAL_CRON_SECRET}`;

  if (!process.env.INTERNAL_CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyCheck();
    console.log("[daily-check]", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[daily-check] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
