/**
 * GET /api/admin/rag-events
 *
 * Query params:
 *   tenantId  — filter by tenant (optional)
 *   method    — "atlas" | "js_fallback" | "miss" (optional)
 *   days      — lookback window in days (default 7, max 30)
 *   limit     — page size (default 50, max 200)
 *   offset    — pagination offset (default 0)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken }    from "@/lib/auth/getServerToken";
import { connectDB }         from "@/lib/db/connect";
import { RagEventLogModel }  from "@/lib/db/models/RagEventLog";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? undefined;
  const method   = searchParams.get("method")   ?? undefined;
  const days     = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset   = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  await connectDB();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const baseFilter: Record<string, unknown> = { createdAt: { $gte: since } };
  if (tenantId) baseFilter.tenantId = tenantId;
  if (method)   baseFilter.method   = method;

  // ── Summary stats ─────────────────────────────────────────────
  const [statsAgg, total, events] = await Promise.all([
    RagEventLogModel.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id:           null,
          totalQueries:  { $sum: 1 },
          atlasHits:     { $sum: { $cond: [{ $eq: ["$method", "atlas"] },       1, 0] } },
          jsFallback:    { $sum: { $cond: [{ $eq: ["$method", "js_fallback"] }, 1, 0] } },
          misses:        { $sum: { $cond: [{ $eq: ["$method", "miss"] },        1, 0] } },
          avgTopScore:   { $avg: "$topScore" },
          avgDurationMs: { $avg: "$durationMs" },
        },
      },
    ]),

    RagEventLogModel.countDocuments(baseFilter),

    RagEventLogModel
      .find(baseFilter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("tenantId sessionId querySnippet method hitsCount topScore avgScore durationMs createdAt")
      .lean(),
  ]);

  const s = statsAgg[0] ?? {
    totalQueries: 0, atlasHits: 0, jsFallback: 0, misses: 0,
    avgTopScore: 0, avgDurationMs: 0,
  };

  const hitRate = s.totalQueries > 0
    ? +((1 - s.misses / s.totalQueries) * 100).toFixed(1)
    : 0;

  return NextResponse.json({
    stats: {
      totalQueries:  s.totalQueries,
      atlasHits:     s.atlasHits,
      jsFallback:    s.jsFallback,
      misses:        s.misses,
      hitRate,
      avgTopScore:   +(s.avgTopScore ?? 0).toFixed(3),
      avgDurationMs: Math.round(s.avgDurationMs ?? 0),
      days,
    },
    total,
    events,
  });
}
