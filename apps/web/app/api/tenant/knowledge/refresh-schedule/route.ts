/**
 * GET  /api/tenant/knowledge/refresh-schedule  → read this tenant's auto-refresh settings
 * PUT  /api/tenant/knowledge/refresh-schedule  → update { enabled?, intervalHours? }
 *
 * Lets each shop turn on automatic Knowledge Base refresh and pick how often
 * it runs (e.g. every 6 hours). The actual work is performed by the hourly
 * cron (/api/cron/kb-auto-refresh) which reads intervalHours from here.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import {
  getRefreshSchedule,
  KnowledgeRefreshScheduleModel,
  REFRESH_INTERVAL_PRESETS,
} from "@/lib/db/models/KnowledgeRefreshSchedule";

export const dynamic = "force-dynamic";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

function serialize(doc: Awaited<ReturnType<typeof getRefreshSchedule>>) {
  return {
    enabled:       doc.enabled,
    intervalHours: doc.intervalHours,
    status:        doc.status,
    lastRunAt:     doc.lastRunAt,
    nextRunAt:     doc.nextRunAt,
    lastResult:    doc.lastResult,
    presets:       REFRESH_INTERVAL_PRESETS,
  };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }
    await connectDB();
    const doc = await getRefreshSchedule(resolved.tenantId);
    return json({ ok: true, schedule: serialize(doc) });
  } catch (err) {
    console.error("[knowledge/refresh-schedule:GET]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }

    let body: { enabled?: boolean; intervalHours?: number };
    try { body = await req.json(); }
    catch { return json({ ok: false, error: "invalid_body" }, 400); }

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    if (body.intervalHours != null) {
      if (!REFRESH_INTERVAL_PRESETS.includes(body.intervalHours as never)) {
        return json({ ok: false, error: "invalid_interval" }, 400);
      }
      update.intervalHours = body.intervalHours;
      // Re-arm the next run relative to now when the cadence changes (only when idle).
      update.nextRunAt = new Date();
    }
    if (Object.keys(update).length === 0) {
      return json({ ok: false, error: "nothing_to_update" }, 400);
    }

    await connectDB();
    await getRefreshSchedule(resolved.tenantId); // ensure the doc exists
    const doc = await KnowledgeRefreshScheduleModel.findOneAndUpdate(
      { tenantId: resolved.tenantId },
      { $set: update },
      { new: true },
    );

    return json({ ok: true, schedule: serialize(doc!) });
  } catch (err) {
    console.error("[knowledge/refresh-schedule:PUT]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
