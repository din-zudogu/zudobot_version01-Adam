import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { createPartnerCheckoutSession } from "@/lib/stripe/partnerHelpers";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";
import { resolveCheckoutPricingFromAuthority } from "@/lib/pricing/checkoutPricingAuthority";

/**
 * Public — partner sends the end-user here with a signed invite token.
 * Creates a Stripe Checkout on the partner's connected account.
 *
 * POST body: { inviteToken, planId, memoryId, retentionId, tenantId, email, name }
 * inviteToken links back to the PartnerProfile.
 */
export async function POST(req: NextRequest) {
  let body: {
    inviteToken: string;
    planId:      string;
    memoryId:    string;
    retentionId: string;
    tenantId:    string;
    email:       string;
    name:        string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { inviteToken, planId, memoryId, retentionId, tenantId, email, name } = body;
  if (!inviteToken || !planId || !memoryId || !retentionId || !tenantId || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ inviteToken }).lean();
  if (!partner) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  if (!partner.isStripeConnected || !partner.stripeConnectAccountId) {
    return NextResponse.json({ error: "partner_not_connected" }, { status: 400 });
  }

  // SECURITY: ราคาจาก Master Config — ไม่เชื่อยอดจาก frontend
  let endUserPriceThb: number;
  let partnerCostThb: number;

  const pricing = await resolveCheckoutPricingFromAuthority({
    buyerRole: "PARTNER",
    planId,
    memoryId,
    retentionId,
  });

  if ("error" in pricing) {
    const [basePkg, memPkg, retPkg] = await Promise.all([
      PackageConfigModel.findOne({ packageId: planId, packageType: "base" }).lean(),
      PackageConfigModel.findOne({ packageId: memoryId, packageType: "memory_addon" }).lean(),
      PackageConfigModel.findOne({ packageId: retentionId, packageType: "retention_addon" }).lean(),
    ]);
    if (!basePkg || !memPkg || !retPkg) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
    if (basePkg.partnerCost === undefined || basePkg.partnerCost === null) {
      return NextResponse.json({ error: "plan_not_resellable" }, { status: 400 });
    }
    endUserPriceThb =
      (basePkg.priceThb ?? 0) + (memPkg.priceThb ?? 0) + (retPkg.priceThb ?? 0);
    partnerCostThb = basePkg.partnerCost;
  } else {
    if (pricing.lines.length === 0) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
    endUserPriceThb = pricing.customerChargeThb;
    partnerCostThb = pricing.zudobotReceivableThb;
  }

  // Get existing subscription for customer ID if any
  const [existingSub, profile] = await Promise.all([
    SubscriptionModel.findOne({ tenantId }).lean(),
    TenantProfileModel.findOne({ tenantId }).lean(),
  ]);

  const checkoutUrl = await createPartnerCheckoutSession({
    tenantId,
    email,
    name:                   name || email,
    customerId:             existingSub?.stripeCustomerId,
    planId:                 planId as PlanId,
    memoryId:               memoryId as MemoryAddonId,
    retentionId:            retentionId as RetentionAddonId,
    partnerStripeAccountId: partner.stripeConnectAccountId,
    partnerCostThb,
    endUserPriceThb,
    partnerId:              partner._id.toString(),
  });

  void profile; // used to confirm profile exists — not needed in response
  return NextResponse.json({ url: checkoutUrl });
}
