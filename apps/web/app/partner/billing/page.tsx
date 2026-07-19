"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface LineItem {
  tenantId:       string;
  businessName:   string;
  planId:         string;
  partnerCostThb: number;
}

interface Invoice {
  _id:                  string;
  invoiceNumber:        string;
  billingMonth:         number;
  billingYear:          number;
  lineItems:            LineItem[];
  subtotalThb:          number;
  vatThb:               number;
  totalThb:             number;
  status:               "open" | "paid" | "void";
  stripePaymentLinkUrl?: string;
  issuedAt:             string;
  dueDate:              string;
  paidAt?:              string;
}

const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const STATUS_STYLE: Record<string, string> = {
  open:  "bg-amber-100 text-amber-700",
  paid:  "bg-green-100 text-green-700",
  void:  "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  open: "รอชำระ",
  paid: "ชำระแล้ว",
  void: "ยกเลิก",
};

function BillingContent() {
  const searchParams = useSearchParams();
  const paid         = searchParams.get("paid") === "1";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const limit = 12;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/partner/invoices?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => { setInvoices(d.invoices ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  const thb        = (n: number) => `฿${n.toLocaleString("th-TH")}`;
  const totalPages = Math.ceil(total / limit);
  const periodLabel = (inv: Invoice) => `${THAI_MONTHS[inv.billingMonth]} ${inv.billingYear + 543}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Billing</h1>
        <p className="text-sm text-text-muted mt-1">ใบแจ้งหนี้รายเดือน — ค่าบริการ Tenant ที่คุณเปิดใช้งาน</p>
      </div>

      {paid && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          การชำระเงินสำเร็จ ขอบคุณ!
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
          กำลังโหลด…
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-surface-primary rounded-2xl border border-border-default flex items-center justify-center h-48 text-text-muted text-sm">
          ยังไม่มีใบแจ้งหนี้
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv._id} className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary">{periodLabel(inv)}</span>
                    <span className="text-xs text-text-muted font-mono">{inv.invoiceNumber}</span>
                    <span className={["text-xs font-semibold px-2 py-0.5 rounded-full", STATUS_STYLE[inv.status]].join(" ")}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {inv.lineItems.length} Tenant · ครบกำหนด {new Date(inv.dueDate).toLocaleDateString("th-TH")}
                    {inv.paidAt && ` · ชำระ ${new Date(inv.paidAt).toLocaleDateString("th-TH")}`}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-text-primary">{thb(inv.totalThb)}</span>

                  {inv.status === "open" && inv.stripePaymentLinkUrl && (
                    <a
                      href={inv.stripePaymentLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
                    >
                      ชำระเงิน →
                    </a>
                  )}

                  <button
                    onClick={() => setExpanded(expanded === inv._id ? null : inv._id)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {expanded === inv._id ? "ซ่อน" : "รายละเอียด"}
                  </button>
                </div>
              </div>

              {/* Expanded line items */}
              {expanded === inv._id && (
                <div className="border-t border-border-default bg-surface-secondary px-5 py-4 space-y-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left pb-2 font-medium">ลูกค้า</th>
                        <th className="text-left pb-2 font-medium">แผน</th>
                        <th className="text-right pb-2 font-medium">ค่าทุน/เดือน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {inv.lineItems.map((item, i) => (
                        <tr key={i} className="text-text-secondary">
                          <td className="py-2">{item.businessName}</td>
                          <td className="py-2 capitalize">{item.planId}</td>
                          <td className="py-2 text-right">{thb(item.partnerCostThb)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-border-default pt-3 space-y-1 text-xs text-text-secondary">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{thb(inv.subtotalThb)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT 7%</span>
                      <span>{thb(inv.vatThb)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-text-primary text-sm pt-1">
                      <span>รวมทั้งหมด</span>
                      <span>{thb(inv.totalThb)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40">
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function PartnerBillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <BillingContent />
    </Suspense>
  );
}
