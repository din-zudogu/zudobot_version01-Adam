/**
 * POST /api/cron/kb-auto-refresh
 *
 * Scheduled cron endpoint — protected by the shared INTERNAL_CRON_SECRET.
 * Triggered hourly by the `kbAutoRefreshCron` Lambda (AWS EventBridge).
 * Accepts either header form:
 *   x-cron-secret: <INTERNAL_CRON_SECRET>
 *   Authorization: Bearer <INTERNAL_CRON_SECRET>
 *
 * Each call advances the due tenants' refresh cycles (re-fetch URL sources +
 * re-embed) and runs continuous self-learning, all within a wall-clock budget
 * so the work resumes across ticks for large knowledge bases.
 */
import { NextRequest, NextResponse } from "next/server";
import { runRefreshCron } from "@/lib/knowledge/autoRefresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s of compute for this route

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runRefreshCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[kb-auto-refresh] cron failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
