/**
 * POST /api/tenant/account/recover
 * Cancels a pending soft-delete: clears pendingDeleteAt and re-activates the bot.
 * Accessible even while pendingDeleteAt is set (middleware allows this path).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { logSystemEvent } from "@/lib/logging/systemLogger";

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenantId = token.sub;
  await connectDB();

  const user = await UserModel.findById(tenantId);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!user.pendingDeleteAt) return NextResponse.json({ ok: true, message: "already_active" });
  if (user.deletedByAdmin) {
    return NextResponse.json({ error: "deleted_by_admin" }, { status: 403 });
  }

  // Determine which botState to restore
  const sub = await SubscriptionModel.findOne({ tenantId, status: "active" });
  let restoredState: string;
  if (sub) {
    restoredState = "active";
  } else if (user.trialEndsAt && user.trialEndsAt > new Date()) {
    restoredState = "trial";
  } else {
    restoredState = "suspended_payment";
  }

  await UserModel.findByIdAndUpdate(tenantId, {
    $unset: { pendingDeleteAt: 1 },
    botState: restoredState,
  });
  await logSystemEvent({
    category: "bot_state", action: "bot_state_change", email: user.email,
    details: { previousState: user.botState, nextState: restoredState, reason: "tenant_self_recover" },
  });

  return NextResponse.json({ ok: true, restoredState });
}
