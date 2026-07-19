/**
 * GET /api/widget/updates
 * Widget polls this to receive admin messages during human handoff.
 * Auth: embedKey + sessionId (same as /api/widget/chat)
 *
 * Query params:
 *   key       — embed key
 *   sessionId — session ID
 *   since     — ISO timestamp; returns admin messages newer than this
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function json(data: unknown, status: number, origin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: NextRequest) {
  const rawOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
  const { searchParams } = new URL(req.url);

  const embedKey  = searchParams.get("key");
  const sessionId = searchParams.get("sessionId");
  const since     = searchParams.get("since");

  if (!embedKey || !sessionId) {
    return json({ error: "key and sessionId required" }, 400, rawOrigin);
  }

  await connectDB();

  const profile = await TenantProfileModel.findOne({ embedKey }).lean();
  if (!profile) return json({ error: "invalid_key" }, 403, rawOrigin);

  const session = await ConversationSessionModel.findOne({
    tenantId: profile.tenantId,
    sessionId,
  }).lean();

  if (!session) {
    return json({ messages: [], botStatus: "bot" }, 200, rawOrigin);
  }

  const sinceDate     = since ? new Date(since) : new Date(0);
  const adminMessages = session.messages.filter(
    (m) => m.role === "admin" && new Date(m.timestamp) > sinceDate,
  );

  return json(
    { messages: adminMessages, botStatus: session.botStatus ?? "bot" },
    200,
    rawOrigin,
  );
}
