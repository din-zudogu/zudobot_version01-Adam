/**
 * POST /api/cron/few-shot-extract
 *
 * Scheduled cron endpoint — protected by x-cron-secret header.
 * Call from AWS EventBridge Scheduler (or any external cron service):
 *
 *   Method:  POST
 *   URL:     https://zudobot.zudogu.com/api/cron/few-shot-extract
 *   Header:  x-cron-secret: <INTERNAL_CRON_SECRET>
 *
 * Reads interval config from SelfLearningConfig in DB so admin can
 * update interval without redeploying.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/lib/db/connect";
import { getSelfLearningConfig, SelfLearningConfigModel } from "@/lib/db/models/SelfLearningConfig";
import { extractFewShotExamples }    from "@/lib/ai/fewShotExtractor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();
  const cfg = await getSelfLearningConfig();

  if (!cfg.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const result = await extractFewShotExamples(cfg.lookbackDays, cfg.maxPerRun);

  const intervalMs = cfg.intervalHours * 60 * 60 * 1000;
  await SelfLearningConfigModel.updateOne(
    { key: "global" },
    { $set: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + intervalMs), lastResult: result } },
  );

  return NextResponse.json({ ok: true, result });
}
