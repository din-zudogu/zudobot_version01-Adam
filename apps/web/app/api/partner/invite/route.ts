import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { generateInviteToken } from "@/lib/db/models/PartnerProfile";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

function getBaseUrl(): string {
  return AMPLIFY_CONFIG.authUrl;
}

/**
 * POST — generate a client checkout link.
 * Body: { planId, memoryId, retentionId }
 * Returns: { checkoutUrl } — partner shares this with their client.
 *
 * The URL carries the partner's inviteToken so the checkout API can identify the partner.
 */
export async function POST(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { planId: string; memoryId: string; retentionId: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { planId, memoryId, retentionId } = body;
  if (!planId || !memoryId || !retentionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub });
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!partner.isStripeConnected) {
    return NextResponse.json({ error: "stripe_not_connected" }, { status: 400 });
  }

  // Verify the plan is resellable
  const basePkg = await PackageConfigModel.findOne({ packageId: planId, packageType: "base" }).lean();
  if (!basePkg || basePkg.partnerCost === undefined || basePkg.partnerCost === null) {
    return NextResponse.json({ error: "plan_not_resellable" }, { status: 400 });
  }

  // Refresh invite token (single-use; a new link revokes the old one)
  const inviteToken = generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await PartnerProfileModel.findByIdAndUpdate(partner._id, {
    inviteToken,
    inviteExpiresAt,
  });

  // The checkout link — end-user opens this, no login needed
  const params = new URLSearchParams({ token: inviteToken, planId, memoryId, retentionId });
  const checkoutUrl = `${getBaseUrl()}/partner/checkout?${params.toString()}`;

  return NextResponse.json({ checkoutUrl, expiresAt: inviteExpiresAt });
}
