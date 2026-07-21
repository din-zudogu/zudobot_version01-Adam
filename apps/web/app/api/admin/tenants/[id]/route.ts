/**
 * PATCH /api/admin/tenants/[id]
 * Body: { action: "soft_delete" | "hard_delete" | "restore" }
 *
 * soft_delete — sets pendingDeleteAt +90 days, deletedByAdmin=true, botState="disabled"
 * hard_delete — cancels Stripe subscription + cascade-deletes all tenant data
 * restore     — clears pendingDeleteAt + deletedByAdmin, restores appropriate botState
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { softDeleteTenant, hardDeleteTenant, restoreTenant } from "@/lib/admin/tenantActions";
import { logSystemEvent } from "@/lib/logging/systemLogger";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: tenantId } = await params;

  let body: { action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { action } = body;
  if (!["soft_delete", "hard_delete", "restore"].includes(action ?? "")) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  await connectDB();

  const user = await UserModel.findById(tenantId);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.role !== "tenant") {
    return NextResponse.json({ error: "not_a_tenant" }, { status: 400 });
  }

  const actorEmail = (token.email as string | undefined)?.toLowerCase();

  if (action === "soft_delete") {
    const result = await softDeleteTenant(tenantId);
    await logSystemEvent({
      category: "admin_action", action: "soft_delete", email: user.email, actorEmail,
      details: { targetType: "tenant", ...result },
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "hard_delete") {
    await hardDeleteTenant(tenantId);
    await logSystemEvent({
      category: "admin_action", action: "hard_delete", email: user.email, actorEmail,
      details: { targetType: "tenant" },
    });
    return NextResponse.json({ ok: true });
  }

  // restore
  const result = await restoreTenant(tenantId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  await logSystemEvent({
    category: "admin_action", action: "restore", email: user.email, actorEmail,
    details: { targetType: "tenant", ...result },
  });
  return NextResponse.json(result);
}
