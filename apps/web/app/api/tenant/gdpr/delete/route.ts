/**
 * DELETE /api/tenant/gdpr/delete
 *
 * Hard-deletes ALL conversation session data for this tenant's end users.
 * Requires 2-step confirmation: body must include { confirm: "DELETE_ALL_DATA" }.
 *
 * Deletes from:
 *   - ConversationSession (all sessions for this tenant)
 *
 * GDPR Right to Erasure (Article 17).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

const CONFIRM_PHRASE = "DELETE_ALL_DATA";

export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { confirm?: string; sessionId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  // 2-step confirmation
  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: "confirmation_required", hint: `ส่ง { "confirm": "${CONFIRM_PHRASE}" } เพื่อยืนยัน` },
      { status: 400 }
    );
  }

  const tenantId = token.sub;

  try {
    await connectDB();

    let deletedCount = 0;

    if (body.sessionId) {
      // Delete a single session's data
      const res = await ConversationSessionModel.deleteOne({ tenantId, sessionId: body.sessionId });
      deletedCount = res.deletedCount;
    } else {
      // Delete all sessions for this tenant
      const res = await ConversationSessionModel.deleteMany({ tenantId });
      deletedCount = res.deletedCount;
    }

    return NextResponse.json({
      ok: true,
      deletedSessions: deletedCount,
      deletedAt: new Date().toISOString(),
      message: `ลบข้อมูล ${deletedCount} session สำเร็จ`,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
