/**
 * GET /api/v1/live-chat/updates
 * Widget polls this endpoint to receive admin messages during human handoff.
 * Auth: x-api-key (same as chat endpoint)
 *
 * Query params:
 *   sessionId — required
 *   since     — ISO timestamp; returns only messages newer than this
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import ChatSessionModel from "@/models/chatSession";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status, cors);

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const since     = searchParams.get("since");

  if (!sessionId) return json({ error: "sessionId required" }, 400, cors);

  await dbConnect();

  const session = await ChatSessionModel.findOne({
    sessionId,
    tenantId: auth.tenant._id,
  }).lean();

  if (!session) return json({ messages: [], botStatus: "bot" }, 200, cors);

  const sinceDate = since ? new Date(since) : new Date(0);
  const adminMessages = session.messages.filter(
    (m) => m.role === "admin" && new Date(m.timestamp) > sinceDate
  );

  return json(
    { messages: adminMessages, botStatus: session.botStatus ?? "bot" },
    200,
    cors
  );
}
