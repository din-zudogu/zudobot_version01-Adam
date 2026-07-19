import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { UserModel } from "@/lib/db/models/User";
import { getPlatformSettings } from "@/lib/db/models/PlatformSettings";
import { generateTaxInvoice } from "@/lib/invoice/taxInvoice";
import { buildReceiptHtml } from "@/lib/invoice/receiptHtml";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const [invoice, cfg] = await Promise.all([
      InvoiceModel.findOne({ _id: params.id, tenantId: token.sub }),
      getPlatformSettings(),
    ]);
    if (!invoice) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const [sub, kyc, user] = await Promise.all([
      SubscriptionModel.findOne({ tenantId: token.sub }),
      KycSubmissionModel.findOne({ tenantId: token.sub, status: "approved" }).sort({ createdAt: -1 }),
      UserModel.findById(token.sub).select("name email"),
    ]);

    const taxData = generateTaxInvoice({
      invoiceNumber: invoice.invoiceNumber,
      buyer: {
        name:             kyc?.legalName ?? user?.name ?? "—",
        taxId:            kyc?.taxId,
        address:          kyc?.address ?? "",
        isJuristicPerson: !!kyc?.taxId,
      },
      planId:         (sub?.planId as PlanId)                    ?? "starter",
      memoryId:       (sub?.memoryAddonId as MemoryAddonId)      ?? "free",
      retentionId:    (sub?.retentionAddonId as RetentionAddonId) ?? "standard",
      periodStart:    invoice.issuedAt,
      periodEnd:      invoice.dueDate,
      daysUntilDue:   cfg.invoiceDueDays,
      whtExempt:      kyc?.whtExempt ?? false,
      whtRate:        kyc?.whtRate ?? cfg.whtRate,
      vatRate:        cfg.vatRate,
      sellerOverride: {
        name:    cfg.invoiceSellerName,
        taxId:   cfg.invoiceSellerTaxId,
        address: cfg.invoiceSellerAddress,
        phone:   cfg.invoiceSellerPhone,
        email:   cfg.invoiceSellerEmail,
      },
    });

    const html = buildReceiptHtml(taxData, {
      isVatRegistered: cfg.invoiceSellerIsVatRegistered,
      showVat:         cfg.invoiceReceiptShowVat,
      showWht:         cfg.invoiceReceiptShowWht,
      footerNote:      cfg.invoiceReceiptFooterNote || undefined,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="receipt-${invoice.invoiceNumber}.html"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
