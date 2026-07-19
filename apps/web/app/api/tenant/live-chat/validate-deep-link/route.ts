/**
 * GET /api/tenant/live-chat/validate-deep-link?token=xxx&sessionId=xxx
 *
 * Validates a short-lived deep link token sent in LINE Notify.
 * Token expires in 10 minutes and can only be used once.
 * Returns the sessionId if valid so the page can confirm it's a legitimate click.
 * Does NOT bypass normal dashboard auth — requires valid NextAuth session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deepLinkToken = searchParams.get("token");
  const sessionId     = searchParams.get("sessionId");

  if (!deepLinkToken || !sessionId) {
    return NextResponse.json({ valid: false, error: "missing_params" }, { status: 400 });
  }

  try {
    await connectDB();

    const session = await ConversationSessionModel.findOne({
      tenantId:  token.sub,
      sessionId,
      "deepLinkTokens.token": deepLinkToken,
    }).lean();

    if (!session) {
      return NextResponse.json({ valid: false, error: "token_not_found" });
    }

    const entry = session.deepLinkTokens.find((t) => t.token === deepLinkToken);
    if (!entry) {
      return NextResponse.json({ valid: false, error: "token_not_found" });
    }

    if (entry.usedAt) {
      return NextResponse.json({ valid: false, error: "token_already_used" });
    }

    const now = new Date();
    if (now > entry.expiresAt) {
      return NextResponse.json({ valid: false, error: "token_expired" });
    }

    // Mark as used (audit trail)
    await ConversationSessionModel.updateOne(
      { tenantId: token.sub, sessionId, "deepLinkTokens.token": deepLinkToken },
      { $set: { "deepLinkTokens.$.usedAt": now } }
    );

    return NextResponse.json({ valid: true, sessionId });
  } catch {
    return NextResponse.json({ valid: false, error: "server_error" }, { status: 500 });
  }
}
