/**
 * Thai Tax Invoice / Receipt HTML generator
 *
 * Produces a self-contained HTML string that:
 *   - Renders as ใบกำกับภาษีแบบเต็ม when isVatRegistered=true
 *   - Falls back to ใบเสร็จรับเงิน when not VAT-registered
 *   - Is print-ready (A4) with @media print CSS
 *   - Uses Sarabun font for full Thai Unicode support
 *
 * Thai legal requirements covered:
 *   1. Title: "ใบกำกับภาษี" / "ใบเสร็จรับเงิน"
 *   2. Seller name, address, tax ID
 *   3. Buyer name, address, tax ID (if juristic)
 *   4. Invoice number + issue date + due date
 *   5. Line items: description, qty, unit price, amount
 *   6. Subtotal, VAT 7%, WHT 3%, Net total
 */

import type { TaxInvoiceData } from "./taxInvoice";

export interface ReceiptRenderOptions {
  isVatRegistered?: boolean;
  showVat?:         boolean;
  showWht?:         boolean;
  footerNote?:      string;
}

function thb(amount: number): string {
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function buildReceiptHtml(data: TaxInvoiceData, opts: ReceiptRenderOptions = {}): string {
  const isVatReg  = opts.isVatRegistered ?? true;
  const showVat   = opts.showVat ?? true;
  const showWht   = opts.showWht ?? true;
  const footer    = opts.footerNote ?? "";

  const docTitle    = isVatReg ? "ใบกำกับภาษี" : "ใบเสร็จรับเงิน";
  const docTitleEn  = isVatReg ? "TAX INVOICE" : "RECEIPT";

  const lineItemsHtml = data.lineItems.map((item) => `
    <tr>
      <td class="desc">${item.description}</td>
      <td class="center">${item.quantity.toLocaleString()}</td>
      <td class="right">${thb(item.unitPrice)}</td>
      <td class="right">${thb(item.amount)}</td>
    </tr>`).join("");

  const vatRow = showVat ? `
    <tr class="sub-row">
      <td colspan="3" class="right label">ภาษีมูลค่าเพิ่ม (VAT ${(data.vatRate * 100).toFixed(0)}%)</td>
      <td class="right">฿${thb(data.vatThb)}</td>
    </tr>` : "";

  const whtRow = (showWht && data.whtThb > 0) ? `
    <tr class="sub-row wht-row">
      <td colspan="3" class="right label">หัก ณ ที่จ่าย (WHT ${(data.whtRate * 100).toFixed(0)}%)</td>
      <td class="right">−฿${thb(data.whtThb)}</td>
    </tr>` : "";

  const buyerTaxRow = data.buyer.taxId
    ? `<p class="meta">เลขประจำตัวผู้เสียภาษี: <strong>${data.buyer.taxId}</strong></p>` : "";

  const footerHtml = footer
    ? `<div class="footer-note"><p>${footer}</p></div>` : "";

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} ${data.invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f0f2f5;
    }

    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #1E5BC6;
      color: white;
      border: none;
      border-radius: 8px;
      font-family: 'Sarabun', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(30,91,198,0.4);
      z-index: 100;
    }
    .print-btn:hover { background: #1749a8; }

    .page {
      width: 794px;
      min-height: 1123px;
      margin: 32px auto;
      background: #ffffff;
      padding: 48px 52px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      position: relative;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #1E5BC6;
      margin-bottom: 28px;
    }
    .seller-block .company-name {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
    }
    .seller-block .meta {
      font-size: 12px;
      color: #555;
      margin-top: 2px;
    }
    .title-block { text-align: right; }
    .doc-title-th {
      font-size: 26px;
      font-weight: 700;
      color: #1E5BC6;
      letter-spacing: 0.5px;
    }
    .doc-title-en {
      font-size: 11px;
      font-weight: 500;
      color: #888;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .invoice-ref {
      margin-top: 10px;
      text-align: right;
    }
    .invoice-ref table { margin-left: auto; border-collapse: collapse; }
    .invoice-ref td { padding: 1px 0 1px 12px; font-size: 12px; }
    .invoice-ref .ref-label { color: #888; text-align: right; }
    .invoice-ref .ref-value { font-weight: 600; color: #1a1a2e; }
    .invoice-ref .number-value { font-size: 14px; font-weight: 700; color: #1E5BC6; }

    /* ── Buyer Block ── */
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .party-box {
      background: #f8f9fb;
      border: 1px solid #e2e6ef;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .party-box .party-label {
      font-size: 10px;
      font-weight: 700;
      color: #1E5BC6;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }
    .party-box .name { font-weight: 600; font-size: 13px; }
    .party-box .meta { font-size: 12px; color: #555; margin-top: 2px; }

    /* ── Line Items Table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    .items-table thead tr {
      background: #1E5BC6;
      color: white;
    }
    .items-table thead th {
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
    }
    .items-table thead th.center { text-align: center; }
    .items-table thead th.right  { text-align: right; }
    .items-table tbody tr { border-bottom: 1px solid #eef0f4; }
    .items-table tbody tr:last-child { border-bottom: 2px solid #c5cce0; }
    .items-table tbody td { padding: 9px 12px; font-size: 12.5px; vertical-align: top; }
    .items-table td.desc   { color: #1a1a2e; }
    .items-table td.center { text-align: center; color: #555; }
    .items-table td.right  { text-align: right; color: #1a1a2e; }

    /* ── Summary rows ── */
    .sub-row td { padding: 5px 12px; font-size: 12.5px; }
    .sub-row .label { color: #555; }
    .total-row td {
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      border-top: 2px solid #1E5BC6;
      background: #f0f4ff;
    }
    .wht-row td { color: #b35a00; }

    /* ── Amount in Words ── */
    .amount-words {
      margin-top: 20px;
      padding: 10px 14px;
      border: 1px dashed #c5cce0;
      border-radius: 6px;
      font-size: 12px;
      color: #555;
    }
    .amount-words strong { color: #1a1a2e; }

    /* ── Signature Section ── */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 36px;
    }
    .sig-box { text-align: center; }
    .sig-line {
      border-top: 1px solid #888;
      margin: 36px 16px 6px;
    }
    .sig-label { font-size: 12px; color: #555; }
    .sig-date  { font-size: 11px; color: #888; margin-top: 2px; }

    /* ── Footer ── */
    .footer-note {
      margin-top: 24px;
      padding: 10px 14px;
      background: #fffbf0;
      border-left: 3px solid #B86B00;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
      color: #7a5500;
    }
    .page-footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e2e6ef;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #aaa;
    }
    .page-footer .brand { color: #1E5BC6; font-weight: 600; }

    /* ── Print styles ── */
    @media print {
      body { background: white; }
      .print-btn { display: none; }
      .page { box-shadow: none; margin: 0; padding: 32px 40px; width: 100%; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">พิมพ์ / Print</button>

  <div class="page">

    <!-- ── Header ── -->
    <div class="header">
      <div class="seller-block">
        <p class="company-name">${data.seller.name}</p>
        <p class="meta">เลขประจำตัวผู้เสียภาษี: ${data.seller.taxId}</p>
        <p class="meta">${data.seller.address}</p>
        ${data.seller.phone ? `<p class="meta">โทร: ${data.seller.phone}</p>` : ""}
        ${data.seller.email ? `<p class="meta">อีเมล: ${data.seller.email}</p>` : ""}
      </div>
      <div class="title-block">
        <p class="doc-title-th">${docTitle}</p>
        <p class="doc-title-en">${docTitleEn}</p>
        <div class="invoice-ref">
          <table>
            <tr>
              <td class="ref-label">เลขที่</td>
              <td class="ref-value number-value">${data.invoiceNumber}</td>
            </tr>
            <tr>
              <td class="ref-label">วันที่ออก</td>
              <td class="ref-value">${thDate(data.issuedAt)}</td>
            </tr>
            <tr>
              <td class="ref-label">ครบกำหนด</td>
              <td class="ref-value">${thDate(data.dueDate)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Parties ── -->
    <div class="parties">
      <div class="party-box">
        <p class="party-label">ผู้ขาย / Seller</p>
        <p class="name">${data.seller.name}</p>
        <p class="meta">เลขภาษี: ${data.seller.taxId}</p>
        <p class="meta">${data.seller.address}</p>
      </div>
      <div class="party-box">
        <p class="party-label">ผู้ซื้อ / Buyer</p>
        <p class="name">${data.buyer.name}</p>
        ${buyerTaxRow}
        ${data.buyer.address ? `<p class="meta">${data.buyer.address}</p>` : ""}
        ${data.buyer.isJuristicPerson ? `<p class="meta" style="color:#1E5BC6;font-size:11px;">นิติบุคคล (Juristic Person)</p>` : ""}
      </div>
    </div>

    <!-- ── Line Items ── -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:58%">รายการ / Description</th>
          <th class="center" style="width:8%">จำนวน</th>
          <th class="right" style="width:17%">ราคาต่อหน่วย (฿)</th>
          <th class="right" style="width:17%">จำนวนเงิน (฿)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
        <!-- Subtotal -->
        <tr class="sub-row">
          <td colspan="3" class="right label">ราคาก่อนภาษี (Subtotal)</td>
          <td class="right">฿${thb(data.subtotalThb)}</td>
        </tr>
        ${vatRow}
        ${whtRow}
        <!-- Net Total -->
        <tr class="total-row">
          <td colspan="3" class="right">ยอดรวมสุทธิ / Net Total</td>
          <td class="right">฿${thb(data.totalThb)}</td>
        </tr>
      </tbody>
    </table>

    ${footerHtml}

    <!-- ── Signatures ── -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <p class="sig-label">ผู้รับเงิน / Received by</p>
        <p class="sig-date">วันที่ / Date: ______________________</p>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <p class="sig-label">ผู้จ่ายเงิน / Paid by</p>
        <p class="sig-date">วันที่ / Date: ______________________</p>
      </div>
    </div>

    <!-- ── Page Footer ── -->
    <div class="page-footer">
      <span>สร้างโดย <span class="brand">Zudobot</span> — zudobot.zudogu.com</span>
      <span>${docTitle} ฉบับนี้ใช้แทนใบเสร็จรับเงิน</span>
    </div>

  </div>
</body>
</html>`;
}
