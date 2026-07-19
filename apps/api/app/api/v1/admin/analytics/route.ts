/**
 * GET /api/v1/admin/analytics
 * Returns aggregated metrics for a tenant's Zudobot activity.
 * Auth: x-secret-key only.
 *
 * Query params:
 *   ?days=7|30  (default 30) — lookback window for trend data
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import ChatSessionModel from "@/models/chatSession";
import RuleViolationModel from "@/models/ruleViolation";
import KnowledgeGapModel from "@/models/knowledgeGap";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  const days     = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") || "30", 10)));
  const since    = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tenantId = String(auth.tenant._id);

  await dbConnect();

  const [
    totalSessions,
    recentSessions,
    handoffSessions,
    sentimentData,
    violationCount,
    topGaps,
    dailyVolume,
    violationsByCategory,
  ] = await Promise.all([
    // All-time session count
    ChatSessionModel.countDocuments({ tenantId }),

    // Sessions in window
    ChatSessionModel.countDocuments({ tenantId, createdAt: { $gte: since } }),

    // Handoff sessions in window
    ChatSessionModel.countDocuments({ tenantId, handoffRequested: true, createdAt: { $gte: since } }),

    // Sentiment average in window (only sessions with non-zero sentiment)
    ChatSessionModel.aggregate([
      { $match: { tenantId: auth.tenant._id, createdAt: { $gte: since }, sentiment: { $ne: 0 } } },
      { $group: { _id: null, avg: { $avg: "$sentiment" }, count: { $sum: 1 } } },
    ]),

    // Total rule violations in window
    RuleViolationModel.countDocuments({ tenantId, createdAt: { $gte: since } }),

    // Top unresolved knowledge gaps (most frequent)
    KnowledgeGapModel.find({ tenantId, resolved: false })
      .sort({ frequency: -1 })
      .limit(10)
      .select("query frequency createdAt")
      .lean(),

    // Daily message volume (sessions created per day in window)
    ChatSessionModel.aggregate([
      { $match: { tenantId: auth.tenant._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sessions: { $sum: 1 },
          messages: { $sum: "$messageCount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Violations by category in window
    RuleViolationModel.aggregate([
      { $match: { tenantId: auth.tenant._id, createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const sentimentAvg    = sentimentData[0]?.avg ?? 0;
  const sentimentCount  = sentimentData[0]?.count ?? 0;
  const handoffRate     = recentSessions > 0 ? Math.round((handoffSessions / recentSessions) * 100) : 0;
  const totalMessages   = dailyVolume.reduce((s: number, d: { messages: number }) => s + d.messages, 0);

  return NextResponse.json({
    ok: true,
    data: {
      window: { days, since },
      overview: {
        totalSessions,
        recentSessions,
        totalMessages,
        handoffSessions,
        handoffRate,
        sentimentAvg: Math.round(sentimentAvg * 10) / 10,
        sentimentCount,
        violationCount,
        unresolvedGaps: topGaps.length,
      },
      topGaps,
      dailyVolume,
      violationsByCategory,
    },
  }, { headers: cors });
}
