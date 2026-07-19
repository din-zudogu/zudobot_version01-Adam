/**
 * POST /api/partner/impersonate   { tenantId }
 *   Validates the partner owns this tenant, returns data needed to start
 *   the impersonation session via session.update() on the client side.
 *
 * DELETE /api/partner/impersonate
 *   Signals the client to deimpersonate (no server state to clear — impersonation
 *   lives entirely in the partner's JWT via session.update()).
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function POST(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { tenantId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { tenantId } = body;
  if (!tenantId) return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "partner_not_found" }, { status: 404 });

  // Verify ownership: this tenant must have a subscription referredByPartnerId = partner._id
  const sub = await SubscriptionModel.findOne({
    tenantId,
    referredByPartnerId: partner._id.toString(),
  }).lean();
  if (!sub) return NextResponse.json({ error: "tenant_not_owned" }, { status: 403 });

  // Fetch client name for display
  const [user, profile] = await Promise.all([
    UserModel.findById(tenantId).select("name email").lean(),
    TenantProfileModel.findOne({ tenantId }).select("businessName").lean(),
  ]);

  const clientName = profile?.businessName || user?.name || tenantId;

  return NextResponse.json({
    ok:         true,
    tenantId,
    clientName,
    partnerId:  partner._id.toString(),
  });
}

export async function DELETE() {
  // Impersonation state lives in the JWT (client calls session.update deimpersonate)
  // This endpoint just confirms the intent so the client knows to call session.update
  return NextResponse.json({ ok: true });
}
