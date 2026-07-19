import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = params;
  let body: { message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  try {
    await connectDB();

    const session = await ConversationSessionModel.findOne({
      sessionId,
      tenantId: token.sub,
    }).lean();

    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    if (session.botStatus === "resolved") {
      return NextResponse.json({ error: "session_already_resolved" }, { status: 409 });
    }

    const now     = new Date();
    const msgSize = Buffer.byteLength(JSON.stringify({ role: "admin", content: message, timestamp: now }), "utf8");

    await ConversationSessionModel.updateOne(
      { sessionId, tenantId: token.sub },
      {
        $push: { messages: { role: "admin", content: message, timestamp: now } },
        $inc:  { sizeBytes: msgSize },
        $set:  { botStatus: "handoff_active", lastActiveAt: now },
      }
    );

    return NextResponse.json({ ok: true, timestamp: now.toISOString() });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
