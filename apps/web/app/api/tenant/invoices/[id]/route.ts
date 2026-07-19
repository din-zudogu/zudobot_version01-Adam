import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { UserModel } from "@/lib/db/models/User";
import { generateTaxInvoice, formatThb } from "@/lib/invoice/taxInvoice";
import { getPlatformSettings } from "@/lib/db/models/PlatformSettings";
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

    return NextResponse.json({
      invoice,
      taxData,
      formatted: {
        subtotal: formatThb(taxData.subtotalThb),
        vat:      formatThb(taxData.vatThb),
        wht:      formatThb(taxData.whtThb),
        total:    formatThb(taxData.totalThb),
      },
      receiptUrl: `/api/tenant/invoices/${params.id}/receipt`,
      isVatRegistered: cfg.invoiceSellerIsVatRegistered,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
