/**
 * POST /api/partner/buy-for-client
 *   Partner buys a package for an existing tenant at partner-cost rate.
 *   Returns { checkoutUrl } — Stripe Checkout Session (one-time) charged to the partner.
 *
 * GET  /api/partner/buy-for-client?session_id=
 *   Activates / upgrades the tenant subscription after Stripe payment succeeds.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { getStripe } from "@/lib/stripe/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { tenantId?: string; planId?: string; quotaAddonId?: string; retentionAddonId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { tenantId, planId, quotaAddonId = "none", retentionAddonId = "standard" } = body;
  if (!tenantId || !planId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  if (partner.status !== "active") return NextResponse.json({ error: "partner_not_active" }, { status: 403 });

  const partnerId = partner._id.toString();

  // Security: partner must own this tenant
  const sub = await SubscriptionModel.findOne({ tenantId, referredByPartnerId: partnerId }).lean();
  if (!sub) return NextResponse.json({ error: "tenant_not_owned" }, { status: 403 });

  // Validate packages and get partner-cost pricing
  const pkgIds = [planId, quotaAddonId, retentionAddonId].filter((id) => id !== "none" && id !== "standard");
  const pkgs   = await PackageConfigModel.find({ packageId: { $in: pkgIds } }).lean();
  const pkgMap = Object.fromEntries(pkgs.map((p) => [p.packageId, p]));

  const basePkg      = pkgMap[planId];
  if (!basePkg || basePkg.partnerCost === undefined) {
    return NextResponse.json({ error: "plan_not_resellable" }, { status: 400 });
  }

  const quotaCost     = quotaAddonId !== "none"     ? (pkgMap[quotaAddonId]?.partnerCost     ?? 0) : 0;
  const retentionCost = retentionAddonId !== "standard" ? (pkgMap[retentionAddonId]?.partnerCost ?? 0) : 0;
  const subtotalThb   = (basePkg.partnerCost ?? 0) + quotaCost + retentionCost;

  // Anti-overlap: if tenant has active subscription, calculate prorated credit
  let proratedCreditThb = 0;
  const existingSub = await SubscriptionModel.findOne({
    tenantId,
    status: { $in: ["active", "trialing"] },
  }).lean();

  if (existingSub?.currentPeriodEnd) {
    const now        = Date.now();
    const periodEnd  = existingSub.currentPeriodEnd.getTime();
    const periodStart = existingSub.currentPeriodStart?.getTime() ?? (periodEnd - 30 * 24 * 60 * 60 * 1000);
    if (periodEnd > now) {
      const totalMs    = periodEnd - periodStart;
      const remainMs   = periodEnd - now;
      const ratio      = Math.max(0, Math.min(1, remainMs / totalMs));
      proratedCreditThb = Math.round((existingSub.totalThb ?? 0) * ratio);
    }
  }

  const chargeThb = Math.max(0, subtotalThb - proratedCreditThb);
  const vatThb    = Math.round(chargeThb * 0.07);
  const totalThb  = chargeThb + vatThb;

  // Fetch display info
  const [tenantUser, tenantProfile] = await Promise.all([
    UserModel.findById(tenantId).select("name email").lean(),
    TenantProfileModel.findOne({ tenantId }).select("businessName").lean(),
  ]);
  const clientName = tenantProfile?.businessName ?? tenantUser?.name ?? tenantId;

  // Create Stripe Checkout Session (one-time, charged to partner)
  const stripe = getStripe();
  const stripePrice = await stripe.prices.create({
    currency:     "thb",
    unit_amount:  Math.max(1, Math.round(totalThb * 100)),
    product_data: {
      name: `Zudobot — ${basePkg.label ?? planId} สำหรับ ${clientName}`,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode:                "payment",
    payment_method_types: ["card"],
    line_items: [{ price: stripePrice.id, quantity: 1 }],
    metadata: {
      action:           "partner_buy_for_client",
      partnerId,
      tenantId,
      planId,
      quotaAddonId,
      retentionAddonId,
      subtotalThb:      String(subtotalThb),
      proratedCreditThb: String(proratedCreditThb),
      totalThb:         String(totalThb),
    },
    success_url: `${APP_URL}/partner/buy-for-client/activate?session_id={CHECKOUT_SESSION_ID}&tenantId=${tenantId}`,
    cancel_url:  `${APP_URL}/partner/clients?cancelled=1`,
  });

  return NextResponse.json({ ok: true, checkoutUrl: session.url, totalThb, proratedCreditThb });
}

// ── GET (activate after payment) ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  const stripe  = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "not_paid" }, { status: 402 });
  }
  if (session.metadata?.action !== "partner_buy_for_client") {
    return NextResponse.json({ error: "wrong_session_type" }, { status: 400 });
  }

  const { partnerId, tenantId, planId, quotaAddonId, retentionAddonId, totalThb } = session.metadata!;

  await connectDB();

  // Security re-check
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner || partner._id.toString() !== partnerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now         = new Date();
  const periodStart = now;
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    {
      planId,
      memoryAddonId:        quotaAddonId,
      retentionAddonId,
      status:               "active",
      currentPeriodStart:   periodStart,
      currentPeriodEnd:     periodEnd,
      cancelAtPeriodEnd:    false,
      paymentMethod:        "card",
      totalThb:             Number(totalThb ?? 0),
      purchasedByPartnerId: partnerId,
      referredByPartnerId:  partnerId,
    },
    { upsert: true, new: true }
  );

  // Activate the user account
  await UserModel.findByIdAndUpdate(tenantId, { botState: "active" });

  return NextResponse.json({ ok: true, tenantId, planId });
}
