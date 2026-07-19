"use client";

import { useState, useEffect } from "react";

const MONTH_ABBR = ["ม.ค","ก.พ","มี.ค","เม.ย","พ.ค","มิ.ย","ก.ค","ส.ค","ก.ย","ต.ค","พ.ย","ธ.ค"];

const STATE_LABEL: Record<string, string> = {
  trial:                       "Trial",
  trial_quota_daily_exhausted: "Trial Quota",
  trial_expired:               "Trial Expired",
  active:                      "Active",
  grace_5pct:                  "Grace Period",
  suspended_quota:             "Suspended Quota",
  suspended_payment:           "Suspended Payment",
  pending_kyc:                 "Pending KYC",
  disabled:                    "Disabled",
};

const STATE_COLOR: Record<string, string> = {
  active:                      "bg-green-500",
  trial:                       "bg-brand-500",
  trial_quota_daily_exhausted: "bg-yellow-400",
  trial_expired:               "bg-orange-400",
  grace_5pct:                  "bg-yellow-500",
  suspended_quota:             "bg-red-500",
  suspended_payment:           "bg-red-600",
  pending_kyc:                 "bg-purple-500",
  disabled:                    "bg-gray-400",
};

function fmt(n: number) {
  return n.toLocaleString("th-TH");
}

interface Totals {
  tenants: number; admins: number;
  activeSubscriptions: number; totalMessages: number;
}
interface StateDist { _id: string; count: number }
interface TopTenant {
  tenantId: string; name: string; email: string;
  totalMessages: number; dailyMessages: number;
}
interface MonthlySignup { _id: { year: number; month: number }; count: number }

interface AnalyticsData {
  totals: Totals;
  botStateDistribution: StateDist[];
  topTenants: TopTenant[];
  monthlySignups: MonthlySignup[];
}

function buildSignupSeries(raw: MonthlySignup[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const found = raw.find((r) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1);
    return { label: MONTH_ABBR[d.getMonth()], count: found?.count ?? 0 };
  });
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className={`bg-surface-primary rounded-2xl border border-border-default p-5 ${accent ?? ""}`}>
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SignupBarChart({ series }: { series: { label: string; count: number }[] }) {
  const max = Math.max(...series.map((s) => s.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {series.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-purple-400 transition-all"
            style={{ height: `${Math.max(4, (s.count / max) * 112)}px` }}
            title={`${s.count} sign-ups`}
          />
          <span className="text-[9px] text-text-muted leading-none">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function CentralizedPage() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
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

  const signupSeries = buildSignupSeries(data.monthlySignups);
  const totalStateCount = data.botStateDistribution.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Big Data Analytics</h1>
        <p className="text-sm text-text-muted mt-0.5">ภาพรวมแพลตฟอร์ม · Bot State · Signups</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tenants"          value={fmt(data.totals.tenants)}             sub="ผู้ใช้ทั้งหมด" />
        <StatCard label="Active Subs"      value={fmt(data.totals.activeSubscriptions)} sub="Subscriptions ที่ Active" />
        <StatCard label="Total Messages"   value={fmt(data.totals.totalMessages)}       sub="ข้อความสะสมทั้งหมด" />
        <StatCard label="Admins"           value={fmt(data.totals.admins)}              sub="Admin + Super Admin" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bot state distribution */}
        <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">Bot State Distribution</p>
          <div className="space-y-2.5">
            {data.botStateDistribution.length === 0 ? (
              <p className="text-xs text-text-muted">ยังไม่มีข้อมูล</p>
            ) : data.botStateDistribution.map((s) => {
              const pct = totalStateCount > 0 ? Math.round((s.count / totalStateCount) * 100) : 0;
              return (
                <div key={s._id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-text-primary font-medium">
                      {STATE_LABEL[s._id] ?? s._id}
                    </span>
                    <span className="text-text-muted">{s.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATE_COLOR[s._id] ?? "bg-gray-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly signups */}
        <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">New Signups (12 เดือนล่าสุด)</p>
          <SignupBarChart series={signupSeries} />
          <p className="mt-3 text-xs text-text-muted">
            รวม: {fmt(signupSeries.reduce((s, x) => s + x.count, 0))} รายการ
          </p>
        </div>
      </div>

      {/* Top tenants by messages */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-4">Top Tenants by Total Messages</p>
        {data.topTenants.length === 0 ? (
          <p className="text-sm text-text-muted">ยังไม่มีข้อมูล</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-muted">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">ผู้เช่า</th>
                <th className="text-right pb-2 font-medium">Messages (Total)</th>
                <th className="text-right pb-2 font-medium">วันนี้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {data.topTenants.map((t, i) => (
                <tr key={t.tenantId} className="hover:bg-surface-secondary transition-colors">
                  <td className="py-2.5 text-text-muted font-medium">{i + 1}</td>
                  <td className="py-2.5">
                    <p className="text-text-primary font-medium">{t.name}</p>
                    <p className="text-text-muted">{t.email}</p>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-text-primary">
                    {fmt(t.totalMessages)}
                  </td>
                  <td className="py-2.5 text-right text-text-muted">{fmt(t.dailyMessages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
