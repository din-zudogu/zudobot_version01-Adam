"use client";

import { useState, useEffect } from "react";

const MONTH_ABBR = ["ม.ค","ก.พ","มี.ค","เม.ย","พ.ค","มิ.ย","ก.ค","ส.ค","ก.ย","ต.ค","พ.ย","ธ.ค"];

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial", starter: "Starter", pro: "Pro", master: "Master", enterprise: "Enterprise",
};

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

interface MonthlyEntry { _id: { year: number; month: number }; revenue: number; count: number }
interface PlanEntry    { _id: string; count: number; revenue: number }
interface RevenueData {
  mrr: number; arr: number; totalRevenue: number; totalInvoicesPaid: number;
  byPlan: PlanEntry[];
  monthlyRevenue: MonthlyEntry[];
  recentInvoices: {
    _id: string; invoiceNumber: string;
    amountPaidThb: number; paidAt: string;
    tenantName: string; tenantEmail: string;
  }[];
}

function buildSeries(raw: MonthlyEntry[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const found = raw.find((r) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1);
    return { label: MONTH_ABBR[d.getMonth()], revenue: found?.revenue ?? 0 };
  });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ series }: { series: { label: string; revenue: number }[] }) {
  const max = Math.max(...series.map((s) => s.revenue), 1);
  return (
    <div className="flex items-end gap-1.5 h-36">
      {series.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-brand-500 transition-all"
            style={{ height: `${Math.max(4, (s.revenue / max) * 128)}px` }}
            title={`฿${fmt(s.revenue)}`}
          />
          <span className="text-[9px] text-text-muted leading-none">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function RevenuePage() {
  const [data, setData]       = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/admin/revenue")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-text-muted animate-pulse">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-red-500">{error || "ไม่มีข้อมูล"}</p>
      </div>
    );
  }

  const series = buildSeries(data.monthlyRevenue);
  const planTotal = data.byPlan.reduce((s, x) => s + x.revenue, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Revenue Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">MRR / ARR และแนวโน้มรายได้รายเดือน</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR"           value={`฿${fmt(data.mrr)}`}               sub="Monthly Recurring Revenue" />
        <StatCard label="ARR"           value={`฿${fmt(data.arr)}`}               sub="Annual Recurring Revenue" />
        <StatCard label="Total Revenue" value={`฿${fmt(data.totalRevenue)}`}      sub="ยอดชำระสะสมทั้งหมด" />
        <StatCard label="Paid Invoices" value={fmt(data.totalInvoicesPaid)}        sub="ใบแจ้งหนี้ที่ชำระแล้ว" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">รายได้รายเดือน (12 เดือนล่าสุด)</p>
          <BarChart series={series} />
          <p className="mt-3 text-xs text-text-muted">
            รวม: ฿{fmt(series.reduce((s, x) => s + x.revenue, 0))}
          </p>
        </div>

        <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">รายได้ตามแพ็กเกจ</p>
          <div className="space-y-3">
            {data.byPlan.length === 0 ? (
              <p className="text-xs text-text-muted">ยังไม่มีข้อมูล</p>
            ) : data.byPlan.map((p) => {
              const pct = planTotal > 0 ? Math.round((p.revenue / planTotal) * 100) : 0;
              return (
                <div key={p._id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-text-primary">{PLAN_LABELS[p._id] ?? p._id}</span>
                    <span className="text-text-muted">{p.count} บัญชี · ฿{fmt(p.revenue)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-4">ใบแจ้งหนี้ที่ชำระล่าสุด</p>
        {data.recentInvoices.length === 0 ? (
          <p className="text-sm text-text-muted">ยังไม่มีรายการ</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-muted">
                <th className="text-left pb-2 font-medium">เลขที่</th>
                <th className="text-left pb-2 font-medium">ผู้เช่า</th>
                <th className="text-right pb-2 font-medium">ยอดชำระ (฿)</th>
                <th className="text-right pb-2 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {data.recentInvoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-surface-secondary transition-colors">
                  <td className="py-2.5 font-mono text-text-primary">{inv.invoiceNumber}</td>
                  <td className="py-2.5">
                    <p className="text-text-primary font-medium">{inv.tenantName}</p>
                    <p className="text-text-muted">{inv.tenantEmail}</p>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-text-primary">{fmt(inv.amountPaidThb)}</td>
                  <td className="py-2.5 text-right text-text-muted">{fmtDate(inv.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
