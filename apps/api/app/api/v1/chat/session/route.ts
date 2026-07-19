/**
 * POST /api/v1/chat/session
 * Creates or resumes a chat session.
 * Returns sessionId + last N messages for context restore.
 * Auth: x-api-key (public key)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import ChatSessionModel from "@/models/chatSession";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: cors });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim()
    ? body.sessionId.trim()
    : crypto.randomUUID();
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : null;

  await dbConnect();

  let session = await ChatSessionModel.findOne({ sessionId, tenantId: auth.tenant._id });

  if (!session) {
    session = await ChatSessionModel.create({
      tenantId: auth.tenant._id,
      sessionId,
      visitorId,
      messages: [],
    });
  }

  // Return last 6 messages for client-side context restore
  const recentMessages = session.messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    history: recentMessages,
  }, { status: 200, headers: cors });
}
