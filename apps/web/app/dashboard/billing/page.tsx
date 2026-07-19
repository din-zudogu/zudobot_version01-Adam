"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PlanInfo {
  id: string; label: string; msgPerDay?: number; memoryMb?: number;
  retentionDays?: number; priceThb: number; memoryLabel?: string; retentionLabel?: string;
}
interface SubInfo {
  planId: string; status: string; currentPeriodEnd: string | null;
  totalThb: number; cancelAtPeriodEnd: boolean;
}
interface Invoice {
  _id: string; invoiceNumber: string; issuedAt: string; dueDate: string;
  status: string; totalThb: number; amountPaidThb: number;
}

const STATUS_STYLE: Record<string, string> = {
  paid:           "bg-green-100 text-green-700",
  open:           "bg-amber-100 text-amber-700",
  draft:          "bg-gray-100 text-gray-500",
  uncollectible:  "bg-red-100 text-red-700",
  void:           "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "ชำระแล้ว", open: "รอชำระ", draft: "ร่าง", uncollectible: "เก็บไม่ได้", void: "ยกเลิก",
};

function thDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function BillingPage() {
  const [plan, setPlan]           = useState<PlanInfo | null>(null);
  const [sub, setSub]             = useState<SubInfo | null>(null);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [invLoading, setInvLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d) => { setPlan(d.plan ?? null); setSub(d.subscription ?? null); setLoading(false); });
  }, []);

  useEffect(() => {
    setInvLoading(true);
    fetch(`/api/tenant/invoices?page=${page}`)
      .then((r) => r.json())
      .then((d) => { setInvoices(d.invoices ?? []); setTotal(d.total ?? 0); setInvLoading(false); });
  }, [page]);

  if (loading) return <Spinner />;

  const isPaid = !!sub && sub.planId !== "trial";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Billing</h1>
        <p className="text-sm text-text-muted mt-0.5">แพ็กเกจปัจจุบัน รอบบิล และใบเสร็จทั้งหมด</p>
      </div>

      {/* Current Plan */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">แพ็กเกจปัจจุบัน</p>
          <p className="text-xl font-bold text-text-primary">{plan?.label ?? "Trial"}</p>
          <p className="text-brand-600 font-semibold text-sm mt-0.5">
            {(plan?.priceThb ?? 0) === 0 ? "ฟรี" : `฿${plan?.priceThb.toLocaleString()}/เดือน`}
          </p>
          <div className="mt-3 space-y-1 text-xs text-text-muted">
            {plan?.msgPerDay !== undefined && (
              <p>{plan.msgPerDay < 0 ? "ข้อความ: ไม่จำกัด" : `${plan.msgPerDay.toLocaleString()} ข้อความ/วัน`}</p>
            )}
            {plan?.memoryLabel  && <p>Memory: {plan.memoryLabel}</p>}
            {plan?.retentionLabel && <p>Retention: {plan.retentionLabel}</p>}
          </div>
          {!isPaid && (
            <Link href="/pricing" className="mt-4 inline-block px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors">
              อัปเกรด →
            </Link>
          )}
        </div>

        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">รอบบิล</p>
          {isPaid && sub ? (
            <>
              <p className="text-xl font-bold text-text-primary">฿{sub.totalThb.toLocaleString()}</p>
              <p className="text-sm text-text-muted mt-0.5">ครบกำหนด {thDate(sub.currentPeriodEnd)}</p>
              <p className={`text-xs mt-2 font-medium ${sub.status === "active" ? "text-green-600" : "text-amber-600"}`}>
                {sub.status === "active" ? "● Active" : sub.status}
              </p>
              {sub.cancelAtPeriodEnd && (
                <p className="text-xs text-red-500 mt-1">จะยกเลิกเมื่อสิ้นรอบ</p>
              )}
            </>
          ) : (
            <>
              <p className="text-text-muted text-sm">ยังไม่มีการสมัครแพ็กเกจ</p>
              <Link href="/pricing" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                ดูแพ็กเกจทั้งหมด →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Invoice List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-text-primary">ประวัติใบแจ้งหนี้ ({total} รายการ)</p>
        </div>

        {invLoading ? (
          <Spinner />
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm bg-surface-primary rounded-2xl border border-border-default">
            ยังไม่มีใบแจ้งหนี้
          </div>
        ) : (
          <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  {["เลขที่ใบแจ้งหนี้","วันที่ออก","ครบกำหนด","ยอดชำระ","สถานะ",""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="border-b border-border-default last:border-0 hover:bg-surface-secondary/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-brand-600 font-semibold">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{thDate(inv.issuedAt)}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{thDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">฿{inv.totalThb.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/api/tenant/invoices/${inv._id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        ใบเสร็จ →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 12 && (
              <div className="px-4 py-3 border-t border-border-default flex items-center gap-3 text-xs text-text-muted">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="hover:text-text-primary disabled:opacity-40">← ก่อนหน้า</button>
                <span>หน้า {page} / {Math.ceil(total / 12)}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * 12 >= total} className="hover:text-text-primary disabled:opacity-40">ถัดไป →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
