/**
 * GET  /api/admin/self-learning-config  — read current config
 * PUT  /api/admin/self-learning-config  — update interval, enabled, lookbackDays, maxPerRun
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken }            from "@/lib/auth/getServerToken";
import { connectDB }                 from "@/lib/db/connect";
import { getSelfLearningConfig, SelfLearningConfigModel } from "@/lib/db/models/SelfLearningConfig";

function requireAdmin(role?: string) { return role === "admin" || role === "super_admin"; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectDB();
  const cfg = await getSelfLearningConfig();
  return NextResponse.json({ config: cfg });
}

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean")           update.enabled       = body.enabled;
  if (typeof body.intervalHours === "number")
    update.intervalHours = Math.min(24, Math.max(1, body.intervalHours));
  if (typeof body.lookbackDays === "number")
    update.lookbackDays  = Math.min(30, Math.max(1, body.lookbackDays));
  if (typeof body.maxPerRun === "number")
    update.maxPerRun     = Math.min(200, Math.max(10, body.maxPerRun));

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  // Recompute nextRunAt when interval changes
  if (update.intervalHours && update.intervalHours !== undefined) {
    const cfg = await getSelfLearningConfig();
    if (cfg.lastRunAt) {
      const intervalMs = (update.intervalHours as number) * 60 * 60 * 1000;
      update.nextRunAt = new Date(cfg.lastRunAt.getTime() + intervalMs);
    }
  }

  await connectDB();
  await SelfLearningConfigModel.updateOne({ key: "global" }, { $set: update }, { upsert: true });
  const updated = await getSelfLearningConfig();
  return NextResponse.json({ ok: true, config: updated });
}
