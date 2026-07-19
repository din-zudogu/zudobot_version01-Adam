"use client";

import { useState, useEffect } from "react";

interface Summary {
  totalClients:        number;
  activeClients:       number;
  totalDailyMessages:  number;
  totalMonthlyMessages:number;
  totalMessages:       number;
}

interface TenantRow {
  tenantId:            string;
  businessName:        string;
  email:               string;
  botState:            string;
  planId:              string;
  subStatus:           string;
  partnerProvisioned:  boolean;
  dailyMessageCount:   number;
  monthlyMessageCount: number;
  totalMessageCount:   number;
}

const BOT_STATE_COLOR: Record<string, string> = {
  active:            "bg-green-100 text-green-700",
  trial:             "bg-blue-100 text-blue-700",
  suspended_payment: "bg-red-100 text-red-700",
  suspended_quota:   "bg-red-100 text-red-700",
  trial_expired:     "bg-gray-100 text-gray-700",
  disabled:          "bg-gray-100 text-gray-500",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{typeof value === "number" ? value.toLocaleString("th-TH") : value}</p>
    </div>
  );
}

export default function PartnerAnalyticsPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [tenants,  setTenants]  = useState<TenantRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/partner/analytics")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? null);
        setTenants(d.tenants ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
        กำลังโหลด…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-muted mt-1">ภาพรวมการใช้งานของ Tenant ทั้งหมดในเครือข่ายของคุณ</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Clients ทั้งหมด"      value={summary.totalClients} />
          <StatCard label="Active Clients"        value={summary.activeClients} />
          <StatCard label="ข้อความวันนี้"          value={summary.totalDailyMessages} />
          <StatCard label="ข้อความเดือนนี้"        value={summary.totalMonthlyMessages} />
          <StatCard label="ข้อความสะสม"           value={summary.totalMessages} />
        </div>
      )}

      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        <div className="px-5 py-3 border-b border-border-default bg-surface-secondary">
          <h2 className="text-sm font-semibold text-text-primary">รายละเอียดต่อ Tenant</h2>
        </div>

        {tenants.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">ยังไม่มี Tenant</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-muted">
                <th className="px-4 py-3 font-medium">Business / Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">วันนี้</th>
                <th className="px-4 py-3 text-right font-medium">เดือนนี้</th>
                <th className="px-4 py-3 text-right font-medium">สะสม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {tenants.map((t) => (
                <tr key={t.tenantId} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{t.businessName}</p>
                    <p className="text-xs text-text-muted">{t.email}</p>
                    {t.partnerProvisioned && (
                      <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">Provisioned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{t.planId}</td>
                  <td className="px-4 py-3">
                    <span className={["text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize", BOT_STATE_COLOR[t.botState] ?? "bg-gray-100 text-gray-700"].join(" ")}>
                      {t.botState.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">{t.dailyMessageCount.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{t.monthlyMessageCount.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{t.totalMessageCount.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
