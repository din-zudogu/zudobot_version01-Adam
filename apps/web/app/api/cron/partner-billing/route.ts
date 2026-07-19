/**
 * POST /api/cron/partner-billing
 *
 * Monthly cron — runs on the 28th of each month (vercel.json: "0 0 28 * *").
 * For each active partner with provisioned tenants:
 *   1. Sweeps active subscriptions with partnerProvisioned=true
 *   2. Calculates cost at partner rate
 *   3. Creates PartnerInvoice (or skips if already exists for this month)
 *   4. Creates Stripe Payment Link
 *   5. Sends invoice email to partner
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { PartnerInvoiceModel, nextPartnerInvoiceNumber } from "@/lib/db/models/PartnerInvoice";
import { getStripe } from "@/lib/stripe/client";
import { sendPartnerConsolidatedInvoiceEmail } from "@/lib/email/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now        = new Date();
  const nextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const billMonth  = nextMonth.getMonth() + 1; // 1-12 (next month)
  const billYear   = nextMonth.getFullYear();
  const dueDate    = new Date(nextMonth.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find all active partners
  const partners = await PartnerProfileModel.find({ status: "active" }).lean();

  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  const errors: string[] = [];

  for (const partner of partners) {
    const partnerId = partner._id.toString();

    try {
      // Skip if invoice already exists for this billing period
      const existing = await PartnerInvoiceModel.findOne({ partnerId, billingMonth: billMonth, billingYear: billYear });
      if (existing) { invoicesSkipped++; continue; }

      // Find all active provisioned subscriptions under this partner
      const subs = await SubscriptionModel.find({
        referredByPartnerId: partnerId,
        partnerProvisioned:  true,
        status:              { $in: ["active", "past_due"] },
      }).lean();

      if (subs.length === 0) { invoicesSkipped++; continue; }

      // Fetch plan configs for cost calculation
      const planIds = Array.from(new Set([
        ...subs.map((s) => s.planId),
        ...subs.map((s) => s.memoryAddonId),
        ...subs.map((s) => s.retentionAddonId),
      ]));
      const pkgs = await PackageConfigModel.find({ packageId: { $in: planIds } }).lean();
      const pkgMap = Object.fromEntries(pkgs.map((p) => [p.packageId, p]));

      // Fetch business names
      const tenantIds = subs.map((s) => s.tenantId);
      const profiles  = await TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName").lean();
      const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));

      // Build line items
      let subtotalThb = 0;
      const lineItems = subs.map((s) => {
        const base = pkgMap[s.planId];
        const mem  = pkgMap[s.memoryAddonId];
        const ret  = pkgMap[s.retentionAddonId];
        const cost = (base?.partnerCost ?? 0) + (mem?.partnerCost ?? 0) + (ret?.partnerCost ?? 0);
        subtotalThb += cost;
        return {
          tenantId:       s.tenantId,
          businessName:   profileMap[s.tenantId]?.businessName ?? s.tenantId,
          planId:         s.planId,
          memAddonId:     s.memoryAddonId,
          retAddonId:     s.retentionAddonId,
          partnerCostThb: cost,
        };
      });

      const vatThb   = Math.round(subtotalThb * 0.07);
      const totalThb = subtotalThb + vatThb;

      // Create Stripe Payment Link
      const stripe = getStripe();
      let stripePaymentLinkId: string | undefined;
      let stripePaymentLinkUrl: string | undefined;
      try {
        const stripePrice = await stripe.prices.create({
          currency:    "thb",
          unit_amount: Math.round(totalThb * 100),
          product_data: {
            name: `Zudobot Partner Invoice ${billYear}-${String(billMonth).padStart(2,"0")} — ${partner.companyName}`,
          },
        });
        const pl = await stripe.paymentLinks.create({
          line_items: [{ price: stripePrice.id, quantity: 1 }],
          metadata: {
            action:    "partner_invoice_payment",
            partnerId,
            billMonth: String(billMonth),
            billYear:  String(billYear),
          },
          after_completion: {
            type:     "redirect",
            redirect: { url: `${APP_URL}/partner/billing?paid=1` },
          },
        });
        stripePaymentLinkId  = pl.id;
        stripePaymentLinkUrl = pl.url;
      } catch (err) {
        console.error(`[partner-billing] Stripe payment link failed for ${partnerId}:`, err);
      }

      const invoiceNumber = await nextPartnerInvoiceNumber();
      const invoice = await PartnerInvoiceModel.create({
        partnerId,
        partnerEmail:       partner.email,
        partnerCompanyName: partner.companyName,
        billingMonth:       billMonth,
        billingYear:        billYear,
        lineItems,
        subtotalThb,
        vatThb,
        totalThb,
        status:             "open",
        stripePaymentLinkId,
        stripePaymentLinkUrl,
        invoiceNumber,
        issuedAt:           now,
        dueDate,
      });

      // Send email
      try {
        await sendPartnerConsolidatedInvoiceEmail({
          to:           partner.email,
          companyName:  partner.companyName,
          invoiceNumber,
          billingMonth: billMonth,
          billingYear:  billYear,
          lineItems,
          subtotalThb,
          vatThb,
          totalThb,
          dueDate,
          paymentUrl:   stripePaymentLinkUrl ?? `${APP_URL}/partner/billing`,
        });
        await PartnerInvoiceModel.findByIdAndUpdate(invoice._id, { emailSentAt: new Date() });
      } catch (err) {
        console.error(`[partner-billing] Email send failed for ${partnerId}:`, err);
      }

      invoicesCreated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${partnerId}: ${msg}`);
      console.error(`[partner-billing] Failed for partner ${partnerId}:`, err);
    }
  }

  console.log(`[partner-billing] Created: ${invoicesCreated}, Skipped: ${invoicesSkipped}, Errors: ${errors.length}`);
  return NextResponse.json({ ok: true, invoicesCreated, invoicesSkipped, errors });
}
