import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = params;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  try {
    await connectDB();
    const session = await ConversationSessionModel.findOne({
      sessionId,
      tenantId: token.sub,
    }).lean();

    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({
      sessionId:    session.sessionId,
      visitorId:    session.endUserId ?? null,
      botStatus:    session.botStatus ?? "bot",
      handoffAt:    session.handoffAt ?? null,
      messages:     session.messages,
      lastActiveAt: session.lastActiveAt,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
