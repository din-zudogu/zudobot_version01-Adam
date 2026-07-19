import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { logSessionEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = params;

  try {
    await connectDB();

    const result = await ConversationSessionModel.updateOne(
      { sessionId, tenantId: token.sub },
      { $set: { botStatus: "bot", resumedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    // Log audit event
    await logSessionEvent(sessionId, token.sub, "resume", { reason: "admin_action" }, "admin");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}