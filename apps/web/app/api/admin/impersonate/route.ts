/**
 * POST /api/admin/impersonate   { tenantId }
 *   super_admin/admin only. Returns data needed to start a permanent
 *   "view as tenant" session via session.update() on the client side —
 *   no ownership restriction, admins get full access to any tenant.
 *
 * DELETE /api/admin/impersonate
 *   Signals the client to deimpersonate (state lives entirely in the JWT).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { logSystemEvent } from "@/lib/logging/systemLogger";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { tenantId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { tenantId } = body;
  if (!tenantId) return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });

  await connectDB();

  const [user, profile] = await Promise.all([
    UserModel.findById(tenantId).select("name email").lean(),
    TenantProfileModel.findOne({ tenantId }).select("businessName").lean(),
  ]);
  if (!user) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const clientName = profile?.businessName || user.name || tenantId;

  await logSystemEvent({
    category:   "admin_action",
    action:     "admin_impersonate_start",
    email:      user.email,
    actorEmail: token!.email?.toLowerCase(),
    details:    { tenantId, clientName },
  });

  return NextResponse.json({ ok: true, tenantId, clientName });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
