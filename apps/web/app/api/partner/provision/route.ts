/**
 * POST /api/partner/provision
 * Partner creates a new Tenant with legal/PII data, selects a package, and pays
 * the partner-cost activation fee via Stripe Checkout.
 *
 * Encrypted PII (national ID, tax ID, phone, email) is stored in PartnerClientData
 * using AES-256-GCM before the record hits MongoDB.
 *
 * GET /api/partner/provision?session_id=<cs_xxx>
 * Called from the Stripe success redirect — verifies payment and activates the Tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { PartnerClientDataModel } from "@/lib/db/models/PartnerClientData";
import { encryptPII } from "@/lib/utils/piiEncrypt";
import { getStripe } from "@/lib/stripe/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";

// ── POST — create pending tenant + Stripe Checkout ───────────────────────────
export async function POST(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    entityType:      "individual" | "corporate";
    // Individual
    fullName?:        string;
    nationalId?:      string;
    addressBilling?:  string;
    // Corporate
    corporateName?:   string;
    taxId?:           string;
    addressOffice?:   string;
    branchCode?:      string;
    contactPerson?:   string;
    // Shared PII
    phone?:           string;
    email:            string;
    // Business
    businessName:     string;
    websiteUrl?:      string;
    // Package
    planId:           string;
    quotaAddonId:     string;   // "none" = no add-on
    retentionAddonId: string;   // "standard" = 7d free
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const {
    entityType = "individual",
    fullName, nationalId, addressBilling,
    corporateName, taxId, addressOffice, branchCode, contactPerson,
    phone, email,
    businessName, websiteUrl,
    planId, quotaAddonId = "none", retentionAddonId = "standard",
  } = body;

  // Basic presence checks
  if (!email || !businessName || !planId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (entityType === "individual" && !fullName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (entityType === "corporate" && (!corporateName || !contactPerson)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // 13-digit validation for encrypted IDs
  if (nationalId) {
    const digits = nationalId.replace(/\D/g, "");
    if (digits.length !== 13) return NextResponse.json({ error: "invalid_national_id" }, { status: 400 });
  }
  if (taxId) {
    const digits = taxId.replace(/\D/g, "");
    if (digits.length !== 13) return NextResponse.json({ error: "invalid_tax_id" }, { status: 400 });
  }

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  if (partner.status !== "active") return NextResponse.json({ error: "partner_not_active" }, { status: 403 });

  // Verify base plan is partner-resellable
  const pkgIds = [planId, quotaAddonId, retentionAddonId].filter(
    (id) => id !== "none" && id !== "standard"
  );
  const pkgs   = await PackageConfigModel.find({ packageId: { $in: pkgIds }, isActive: true }).lean();
  const pkgMap = Object.fromEntries(pkgs.map((p) => [p.packageId, p]));

  const basePkg = pkgMap[planId];
  if (!basePkg || basePkg.partnerCost === undefined) {
    return NextResponse.json({ error: "plan_not_resellable" }, { status: 400 });
  }

  const quotaCost     = quotaAddonId !== "none"     ? (pkgMap[quotaAddonId]?.partnerCost     ?? 0) : 0;
  const retentionCost = retentionAddonId !== "standard" ? (pkgMap[retentionAddonId]?.partnerCost ?? 0) : 0;
  const activationCostThb = (basePkg.partnerCost ?? 0) + quotaCost + retentionCost;

  // Email uniqueness check
  const existing = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
  if (existing) return NextResponse.json({ error: "email_taken" }, { status: 409 });

  // ── Create Tenant User ───────────────────────────────────────────────────────
  const clientName = entityType === "individual" ? (fullName ?? "") : (contactPerson ?? "");
  const newUser    = await UserModel.create({
    email:              email.toLowerCase().trim(),
    name:               clientName.trim(),
    role:               "tenant",
    roles:              ["tenant"],
    onboardingComplete: true,
    botState:           "disabled", // activated after Stripe payment
  });
  const tenantId = newUser._id.toString();
  await UserModel.findByIdAndUpdate(newUser._id, { tenantId });

  // ── Create TenantProfile ─────────────────────────────────────────────────────
  await TenantProfileModel.create({
    tenantId,
    businessName:   businessName.trim(),
    businessType:   "ecommerce",
    websiteUrl:     websiteUrl?.trim() ?? "",
    botName:        "Zudobot",
    botGender:      "female",
    botTone:        "friendly",
    welcomeMessage: "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?",
    widgetColor:    "#1E5BC6",
    widgetPosition: "bottom-right",
    widgetEnabled:  false,
    allowedDomain:  "",
    embedKey:       crypto.randomBytes(16).toString("hex"),
  });

  // ── Create Subscription (unpaid — activated after payment) ───────────────────
  await SubscriptionModel.create({
    tenantId,
    planId,
    memoryAddonId:       quotaAddonId,
    retentionAddonId:    retentionAddonId === "standard" ? "ret_7d" : retentionAddonId,
    status:              "unpaid",
    paymentMethod:       "card",
    basePriceThb:        basePkg.partnerCost ?? 0,
    memoryPriceThb:      quotaCost,
    retentionPriceThb:   retentionCost,
    totalThb:            activationCostThb,
    referredByPartnerId: partner._id.toString(),
    partnerProvisioned:  true,
  });

  // ── Encrypt PII and create PartnerClientData ─────────────────────────────────
  const enc = (v?: string) => (v ? encryptPII(v) : undefined);

  await PartnerClientDataModel.create({
    partnerId: partner._id.toString(),
    tenantId,
    entityType,
    // Individual fields
    ...(entityType === "individual" && {
      fullName:       fullName?.trim(),
      nationalIdEnc:  enc(nationalId?.replace(/\D/g, "")),
      addressBilling: addressBilling?.trim(),
    }),
    // Corporate fields
    ...(entityType === "corporate" && {
      corporateName:  corporateName?.trim(),
      taxIdEnc:       enc(taxId?.replace(/\D/g, "")),
      addressOffice:  addressOffice?.trim(),
      branchCode:     branchCode?.trim(),
      contactPerson:  contactPerson?.trim(),
    }),
    // Shared encrypted PII
    phoneEnc: enc(phone),
    emailEnc: enc(email.toLowerCase().trim()),
  });

  // ── Stripe Checkout — partner pays Zudobot the partner-cost activation fee ───
  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "promptpay"],
    line_items: [{
      price_data: {
        currency: "thb",
        product_data: {
          name:        `เปิดใช้งาน: ${basePkg.label} — ${businessName}`,
          description: `Partner activation for ${email} (partner-provisioned)`,
        },
        unit_amount: Math.round(activationCostThb * 100),
      },
      quantity: 1,
    }],
    mode:           "payment",
    customer_email: partner.email,
    success_url:    `${APP_URL}/partner/provision?activated=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:     `${APP_URL}/partner/provision?cancelled=1`,
    metadata: {
      tenantId,
      partnerId: partner._id.toString(),
      action:    "partner_activation",
    },
  });

  return NextResponse.json({
    ok:          true,
    tenantId,
    checkoutUrl: checkoutSession.url,
    amountThb:   activationCostThb,
  }, { status: 201 });
}

// ── GET — activate tenant after successful Stripe payment ────────────────────
export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  await connectDB();

  const stripe = getStripe();
  let cs: { payment_status: string; metadata: Record<string, string> };
  try {
    cs = await stripe.checkout.sessions.retrieve(sessionId) as typeof cs;
  } catch {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  if (cs.payment_status !== "paid") {
    return NextResponse.json({ error: "not_paid", status: cs.payment_status }, { status: 402 });
  }
  if (cs.metadata.action !== "partner_activation") {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const { tenantId, partnerId } = cs.metadata;

  // Verify the requesting partner owns this tenant
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner || partner._id.toString() !== partnerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Activate the tenant
  await Promise.all([
    UserModel.findByIdAndUpdate(tenantId, { botState: "active" }),
    SubscriptionModel.findOneAndUpdate(
      { tenantId, referredByPartnerId: partnerId },
      {
        status:                  "active",
        currentPeriodStart:      new Date(),
        currentPeriodEnd:        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeCheckoutSessionId: sessionId,
      }
    ),
  ]);

  return NextResponse.json({ ok: true, tenantId });
}
