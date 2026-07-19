"use client";

import { useState, useEffect } from "react";

const BOT_STATE_LABEL: Record<string, { label: string; color: string }> = {
  trial:                       { label: "Trial",            color: "text-brand-600" },
  trial_quota_daily_exhausted: { label: "โควต้าวันนี้เต็ม",   color: "text-yellow-600" },
  trial_expired:               { label: "Trial หมดอายุ",    color: "text-orange-500" },
  active:                      { label: "Active",           color: "text-green-600" },
  grace_5pct:                  { label: "Grace Period",     color: "text-yellow-500" },
  suspended_quota:             { label: "ระงับ (โควต้า)",   color: "text-red-500" },
  suspended_payment:           { label: "ระงับ (ชำระ)",     color: "text-red-600" },
  pending_kyc:                 { label: "รอ KYC",           color: "text-purple-500" },
  disabled:                    { label: "ปิดใช้งาน",        color: "text-gray-500" },
};

function fmt(n: number) { return n.toLocaleString("th-TH"); }
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

interface AnalyticsData {
  dailyUsed:      number;
  dailyQuota:     number;
  dailyPct:       number;
  totalMessages:  number;
  avgPerDay:      number;
  activeSessions: number;
  memberSince:    string;
  botState:       string;
  planId:         string;
  planLabel:      string;
  dailyResetAt:   string;
}

function StatCard({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-surface-primary rounded-2xl border border-border-default p-5 flex items-start gap-3">
      <span className="text-2xl mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl font-bold text-text-primary">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/tenant/analytics")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-text-muted animate-pulse">กำลังโหลด...</div>
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

  const stateInfo = BOT_STATE_LABEL[data.botState] ?? { label: data.botState, color: "text-text-secondary" };
  const barColor  = data.dailyPct >= 95 ? "bg-red-500" : data.dailyPct >= 80 ? "bg-yellow-400" : "bg-brand-500";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-muted mt-0.5">สถิติการใช้งานบอทของคุณ</p>
      </div>

      {/* Daily quota gauge */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">โควต้าวันนี้</p>
          <span className={`text-xs font-semibold ${stateInfo.color}`}>{stateInfo.label}</span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-bold text-text-primary">{fmt(data.dailyUsed)}</span>
          <span className="text-sm text-text-muted">/ {fmt(data.dailyQuota)} ข้อความ</span>
        </div>
        <div className="w-full h-3 rounded-full bg-surface-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${data.dailyPct}%` }}
          />
        </div>
        <p className="text-xs text-text-muted mt-2">
          ใช้ไปแล้ว {data.dailyPct}% · รีเซ็ตทุกเที่ยงคืน ICT
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon="💬"
          label="Messages ทั้งหมด"
          value={fmt(data.totalMessages)}
          sub="นับแต่เปิดบัญชี"
        />
        <StatCard
          icon="📊"
          label="เฉลี่ยต่อวัน"
          value={fmt(data.avgPerDay)}
          sub="ข้อความ/วัน"
        />
        <StatCard
          icon="🔗"
          label="Sessions ที่ Active"
          value={fmt(data.activeSessions)}
          sub="การสนทนาที่บันทึกอยู่"
        />
        <StatCard
          icon="📦"
          label="แพ็กเกจปัจจุบัน"
          value={data.planLabel}
          sub={`${fmt(data.dailyQuota)} ข้อความ/วัน`}
        />
      </div>

      {/* Account info */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-3">ข้อมูลบัญชี</p>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-text-muted">สมาชิกตั้งแต่</p>
            <p className="font-medium text-text-primary">{fmtDate(data.memberSince)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">รีเซ็ตโควต้าล่าสุด</p>
            <p className="font-medium text-text-primary">{fmtDate(data.dailyResetAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
