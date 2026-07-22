/**
 * POST /api/tenant/account/delete
 *
 * Body: { type: "soft" | "hard" }
 *
 * soft — marks account pendingDeleteAt = now + 90 days, disables bot
 * hard — cancels Stripe subscription, cascade-deletes all tenant data, returns { ok: true }
 *        (client should call signOut after receiving ok)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { hardDeleteTenant } from "@/lib/admin/tenantActions";
import { logSystemEvent } from "@/lib/logging/systemLogger";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (body.type !== "soft" && body.type !== "hard") {
    return NextResponse.json({ error: "type must be 'soft' or 'hard'" }, { status: 400 });
  }

  const tenantId = token.sub;
  const email = (token.email as string | undefined)?.toLowerCase();
  await connectDB();

  try {
    if (body.type === "soft") {
      const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);
      const prevUser = await UserModel.findByIdAndUpdate(tenantId, {
        pendingDeleteAt: deletionDate,
        botState: "disabled",
      });
      await logSystemEvent({
        category: "bot_state", action: "bot_state_change", email,
        details: { previousState: prevUser?.botState, nextState: "disabled", reason: "tenant_self_service_soft_delete" },
      });
      return NextResponse.json({ ok: true, deletionDate: deletionDate.toISOString() });
    }

    // Hard delete
    await hardDeleteTenant(tenantId, email);
    await logSystemEvent({
      category: "bot_state", action: "account_hard_delete_self", email,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/delete]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
