/**
 * Thai Tax Invoice Generator
 *
 * Produces a structured InvoiceData object that can be:
 *   1. Stored in MongoDB (IInvoice)
 *   2. Rendered as PDF via a future PDF generation step (Phase 8)
 *   3. Returned as JSON to the client for display
 *
 * Thai requirements:
 *   - ใบกำกับภาษี (Tax Invoice) — VAT-registered sellers
 *   - ใบเสร็จรับเงิน (Receipt) — non-VAT sellers
 *   - WHT (3% on service fees ≥ 1,000 THB for juristic persons)
 *   - Invoice number format: ZUD-YYYY-NNNNNN
 */

import { calculatePrice, DEFAULT_PM_CONFIG } from "@/lib/payment/pmRules";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";

export interface SellerInfo {
  name:    string;
  taxId:   string;
  address: string;
  phone?:  string;
  email?:  string;
}

export interface BuyerInfo {
  name:     string;
  taxId?:   string;
  address:  string;
  isJuristicPerson: boolean;  // WHT applies if true
}

export interface InvoiceLineItem {
  description: string;
  quantity:    number;
  unitPrice:   number;   // THB
  amount:      number;   // THB
}

export interface TaxInvoiceData {
  invoiceNumber:  string;
  taxInvoiceNumber?: string;  // same as invoiceNumber when VAT-registered
  issuedAt:       Date;
  dueDate:        Date;
  seller:         SellerInfo;
  buyer:          BuyerInfo;
  lineItems:      InvoiceLineItem[];
  subtotalThb:    number;
  vatThb:         number;
  vatRate:        number;
  whtThb:         number;
  whtRate:        number;
  whtExempt:      boolean;
  totalThb:       number;   // subtotal + vat - wht
  currency:       "THB";
  notes?:         string;
}

const SELLER: SellerInfo = {
  name:    "บริษัท ซูโดกุ จำกัด (Zudogu Co., Ltd.)",
  taxId:   process.env.COMPANY_TAX_ID ?? "0105567000000",
  address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
  phone:   "+66-2-000-0000",
  email:   "billing@zudogu.com",
};

export interface GenerateInvoiceOptions {
  invoiceNumber:  string;
  buyer:          BuyerInfo;
  planId:         PlanId;
  memoryId:       MemoryAddonId;
  retentionId:    RetentionAddonId;
  periodStart:    Date;
  periodEnd:      Date;
  daysUntilDue?:  number;
  whtExempt?:     boolean;
  whtRate?:       number;
  vatRate?:       number;
  notes?:         string;
  sellerOverride?: Partial<SellerInfo>;
}

export function generateTaxInvoice(opts: GenerateInvoiceOptions): TaxInvoiceData {
  const vatRate = opts.vatRate ?? DEFAULT_PM_CONFIG.vatRate;
  const whtRate = opts.whtExempt ? 0 : (opts.whtRate ?? DEFAULT_PM_CONFIG.whtRate);
  const breakdown = calculatePrice(opts.planId, opts.memoryId, opts.retentionId, {
    vatRate,
    whtRate,
  });

  const periodLabel = `${opts.periodStart.toLocaleDateString("th-TH", { month: "short", year: "numeric" })} – ${opts.periodEnd.toLocaleDateString("th-TH", { month: "short", year: "numeric" })}`;

  const lineItems: InvoiceLineItem[] = [];

  if (breakdown.base > 0) {
    lineItems.push({
      description: `Zudobot ${opts.planId.charAt(0).toUpperCase() + opts.planId.slice(1)} Plan (${periodLabel})`,
      quantity:    1,
      unitPrice:   breakdown.base,
      amount:      breakdown.base,
    });
  }
  if (breakdown.quota > 0) {
    lineItems.push({
      description: `Quota Add-on (${opts.memoryId}) — ${periodLabel}`,
      quantity:    1,
      unitPrice:   breakdown.quota,
      amount:      breakdown.quota,
    });
  }
  if (breakdown.retention > 0) {
    lineItems.push({
      description: `Retention Add-on (${opts.retentionId}) — ${periodLabel}`,
      quantity:    1,
      unitPrice:   breakdown.retention,
      amount:      breakdown.retention,
    });
  }

  const issuedAt = new Date();
  const dueDate = new Date(issuedAt);
  dueDate.setDate(dueDate.getDate() + (opts.daysUntilDue ?? 7));

  const seller: SellerInfo = opts.sellerOverride
    ? { ...SELLER, ...opts.sellerOverride }
    : SELLER;

  return {
    invoiceNumber:     opts.invoiceNumber,
    taxInvoiceNumber:  opts.invoiceNumber,
    issuedAt,
    dueDate,
    seller,
    buyer:             opts.buyer,
    lineItems,
    subtotalThb:       breakdown.subtotal,
    vatThb:            breakdown.vat,
    vatRate,
    whtThb:            opts.whtExempt ? 0 : breakdown.wht,
    whtRate:           opts.whtExempt ? 0 : whtRate,
    whtExempt:         opts.whtExempt ?? false,
    totalThb:          breakdown.total,
    currency:          "THB",
    notes:             opts.notes,
  };
}

/** Format THB amount with commas and 2 decimal places */
export function formatThb(amount: number): string {
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
