/**
 * POST /api/admin/subscribe-for-customer
 * Admin/partner subscribes an EXISTING customer (identified by their Google
 * account email) to a paid plan. Creates a Stripe PromptPay Checkout Session
 * (Stripe renders the QR for the exact amount on its own hosted page) and
 * emails the checkout link to the customer. Payment confirmation happens via
 * the existing /api/stripe/webhook — no new activation logic here.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { createCheckoutSession } from "@/lib/stripe/helpers";
import {
  PLAN_CATALOG,
  MEMORY_ADDON_CATALOG,
  RETENTION_ADDON_CATALOG,
  calculatePrice,
  DEFAULT_PM_CONFIG,
  type PlanId,
  type MemoryAddonId,
  type RetentionAddonId,
} from "@/lib/payment/pmRules";
import { sendAdminSubscribeForCustomerEmail } from "@/lib/email/resend";
import { logSystemEvent } from "@/lib/logging/systemLogger";

function requireAllowedRole(role?: string) {
  return role === "admin" || role === "super_admin" || role === "partner_admin";
}

const VALID_PLANS: PlanId[] = ["starter", "pro", "master"];
const VALID_MEMORY: MemoryAddonId[] = ["free", "small", "medium", "large"];
const VALID_RETENTION: RetentionAddonId[] = ["standard", "1month", "3months", "6months"];

interface Body {
  email:       string;
  planId:      PlanId;
  memoryId:    MemoryAddonId;
  retentionId: RetentionAddonId;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAllowedRole(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const { planId, memoryId, retentionId } = body;

  if (!email.includes("@")) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }
  if (
    !VALID_PLANS.includes(planId) ||
    !VALID_MEMORY.includes(memoryId) ||
    !VALID_RETENTION.includes(retentionId)
  ) {
    return NextResponse.json({ error: "invalid_plan_combo" }, { status: 400 });
  }

  try {
    await connectDB();

    const user = await UserModel.findOne({ email, role: "tenant" });
    if (!user) {
      return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
    }
    const tenantId = user._id.toString();

    // partner_admin may only subscribe tenants they already own
    if (token!.role === "partner_admin") {
      const partner = await PartnerProfileModel.findOne({ userId: token!.sub }).lean();
      if (!partner) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const owned = await SubscriptionModel.exists({
        tenantId,
        referredByPartnerId: (partner._id as { toString(): string }).toString(),
      });
      if (!owned) return NextResponse.json({ error: "tenant_not_owned" }, { status: 403 });
    }

    const existingSub = await SubscriptionModel.findOne({ tenantId }).select("stripeCustomerId").lean();
    const customerId  = existingSub?.stripeCustomerId;

    const { url, sessionId } = await createCheckoutSession({
      tenantId,
      email:        user.email,
      name:         user.name,
      customerId,
      planId,
      memoryId,
      retentionId,
      paymentMethod: "promptpay",
    });

    const breakdown = calculatePrice(planId, memoryId, retentionId, DEFAULT_PM_CONFIG);
    const planLabel = `${PLAN_CATALOG[planId].label} + ${MEMORY_ADDON_CATALOG[memoryId].label} + ${RETENTION_ADDON_CATALOG[retentionId].label}`;

    try {
      await sendAdminSubscribeForCustomerEmail({
        to:          user.email,
        name:        user.name ?? user.email,
        planLabel,
        totalThb:    breakdown.total,
        checkoutUrl: url,
      });
    } catch (err) {
      console.error("[admin/subscribe-for-customer] email send failed:", err);
    }

    await logSystemEvent({
      category:   "payment",
      action:     "admin_subscribe_for_customer",
      email:      user.email,
      actorEmail: token!.email?.toLowerCase(),
      details:    { tenantId, planId, memoryId, retentionId, totalThb: breakdown.total, sessionId },
    });

    return NextResponse.json({
      ok:            true,
      sessionId,
      checkoutUrl:   url,
      totalThb:      breakdown.total,
      customerEmail: user.email,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/subscribe-for-customer]", msg);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
