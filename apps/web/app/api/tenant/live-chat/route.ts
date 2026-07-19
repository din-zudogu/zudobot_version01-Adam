/**
 * GET /api/tenant/live-chat
 *
 * Returns all handoff sessions for this tenant:
 *   - handoff_pending  — waiting for staff
 *   - handoff_active   — staff currently handling
 *   - paused           — bot paused by staff
 *
 * Sorted by handoffAt desc (newest first).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return json({ error: "unauthorized" }, 401);

  const url      = new URL(req.url);
  const statusQ  = url.searchParams.get("status"); // optional filter
  const limitQ   = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  const statusFilter = statusQ
    ? [statusQ]
    : ["handoff_pending", "handoff_active", "paused"];

  try {
    await connectDB();

    const sessions = await ConversationSessionModel.find({
      tenantId:  token.sub,
      botStatus: { $in: statusFilter },
    })
      .sort({ handoffAt: -1, lastActiveAt: -1 })
      .limit(limitQ)
      .select("sessionId botStatus handoffAt lastActiveAt messages sentiment intent consentGiven")
      .lean();

    const data = sessions.map((s) => {
      const msgs        = s.messages ?? [];
      const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
      const lastMsg     = msgs[msgs.length - 1];

      return {
        sessionId:   s.sessionId,
        botStatus:   s.botStatus,
        handoffAt:   s.handoffAt?.toISOString() ?? null,
        lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
        lastMessage: lastUserMsg?.content ?? lastMsg?.content ?? "",
        messageCount: msgs.length,
        sentiment:   (s as { sentiment?: number }).sentiment,
        intent:      (s as { intent?: string }).intent,
      };
    });

    const pending = data.filter((s) => s.botStatus === "handoff_pending").length;
    const active  = data.filter((s) => s.botStatus === "handoff_active").length;

    return json({ sessions: data, counts: { pending, active, total: data.length } });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
