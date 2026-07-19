"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MeData {
  tenantId: string;
  user: { name: string; email: string; botState: string; trialEndsAt: string | null; isVip?: boolean; vipExpiresAt?: string | null };
  profile: { businessName: string; botName: string; embedKey: string; widgetEnabled: boolean; dailyMessageCount: number; totalMessageCount: number };
  subscription: { planId: string; status: string; currentPeriodEnd: string | null; totalThb: number } | null;
  plan: { id: string; label: string; msgPerDay?: number; memoryMb?: number; retentionDays?: number; priceThb: number; memoryLabel?: string; retentionLabel?: string };
  quota: { used: number; limit: number; percent: number; resetAt: string | null };
}

const BOT_STATE: Record<string, { label: string; hint: string; color: string; dot: string }> = {
  trial:                       { label: "ทดลองใช้ (Trial)",           hint: "บอทออนไลน์ในช่วงทดลองใช้",                  color: "bg-brand-600",   dot: "bg-blue-300" },
  trial_quota_daily_exhausted: { label: "โควต้าวันนี้หมดแล้ว",        hint: "บอทหยุดชั่วคราว จะรีเซ็ตเที่ยงคืน",         color: "bg-amber-500",   dot: "bg-amber-200" },
  trial_expired:               { label: "ทดลองใช้หมดอายุแล้ว",        hint: "กรุณาเลือกแพ็กเกจเพื่อใช้งานต่อ",            color: "bg-gray-500",    dot: "bg-gray-300" },
  active:                      { label: "ออนไลน์ (Active)",            hint: "บอทพร้อมตอบลูกค้า",                          color: "bg-green-600",   dot: "bg-green-300" },
  grace_5pct:                  { label: "ใกล้ถึงขีดจำกัด",             hint: "โควต้าใกล้หมด — บอทยังออนไลน์อยู่",          color: "bg-amber-500",   dot: "bg-amber-200" },
  suspended_quota:             { label: "ระงับ (โควต้าเต็ม)",          hint: "โควต้าเต็ม กรุณาอัปเกรดหรือรอรีเซ็ต",        color: "bg-red-600",     dot: "bg-red-300" },
  suspended_payment:           { label: "ระงับ (ค้างชำระ)",            hint: "ชำระค่าบริการที่ค้างเพื่อกลับมาใช้งาน",      color: "bg-red-600",     dot: "bg-red-300" },
  pending_kyc:                 { label: "รอตรวจสอบ KYC",               hint: "ยื่น KYC เพื่อเปิดใช้งานบอทเต็มรูปแบบ",      color: "bg-orange-500",  dot: "bg-orange-200" },
  disabled:                    { label: "ปิดใช้งาน",                   hint: "กรุณาติดต่อ support@zudogu.com",              color: "bg-gray-700",    dot: "bg-gray-400" },
};

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

function thDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function TenantIdCard({ tenantId }: { tenantId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-surface-primary border border-border-default rounded-2xl p-4">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Tenant ID</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 text-sm font-mono text-text-primary bg-surface-secondary rounded-xl px-3 py-2 select-all break-all">
          {tenantId}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(tenantId); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          className="shrink-0 px-3 py-2 text-xs font-semibold rounded-xl border border-border-default bg-white hover:bg-surface-secondary transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  const [me, setMe]         = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d) => { setMe(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!me) return <p className="text-red-500 text-sm">ไม่สามารถโหลดข้อมูลได้</p>;

  const isVipActive = me.user.isVip && me.user.botState === "active";
  const state       = isVipActive
    ? { label: "VIP Active 👑", hint: "สถานะ VIP — บอทพร้อมตอบลูกค้าในโหมด VIP", color: "bg-amber-500", dot: "bg-yellow-200" }
    : (BOT_STATE[me.user.botState] ?? BOT_STATE.trial);
  const trialDays   = daysUntil(me.user.trialEndsAt);
  const vipDays     = daysUntil(me.user.vipExpiresAt ?? null);
  const isPaidPlan  = !!me.subscription && me.subscription.planId !== "trial";

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Bot State Banner ── */}
      <div className={`${state.color} rounded-2xl px-6 py-5 text-white flex items-center justify-between shadow-brand`}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2 h-2 rounded-full ${state.dot} animate-pulse`} />
            <span className="text-sm font-semibold uppercase tracking-wider opacity-90">{state.label}</span>
          </div>
          <p className="text-white/80 text-sm">{state.hint}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold opacity-90">{me.profile.businessName || me.user.name}</p>
          {me.user.botState === "trial" && me.user.trialEndsAt && (
            <p className="opacity-70 text-xs mt-0.5">ทดลองถึง {thDate(me.user.trialEndsAt)} ({trialDays} วัน)</p>
          )}
          {isVipActive && me.user.vipExpiresAt && (
            <p className="opacity-70 text-xs mt-0.5">VIP ถึง {thDate(me.user.vipExpiresAt)} ({vipDays} วัน)</p>
          )}
          {me.user.botState === "active" && !isVipActive && me.subscription?.currentPeriodEnd && (
            <p className="opacity-70 text-xs mt-0.5">ต่ออายุ {thDate(me.subscription.currentPeriodEnd)}</p>
          )}
        </div>
      </div>

      {/* ── Tenant ID ── */}
      <TenantIdCard tenantId={me.tenantId} />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Quota Card */}
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">โควต้าวันนี้</p>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-2xl font-bold text-text-primary">{me.quota.used.toLocaleString()}</span>
            <span className="text-text-muted text-sm mb-0.5">
              / {me.quota.limit < 0 ? "∞" : me.quota.limit.toLocaleString()} ข้อความ
            </span>
          </div>
          {me.quota.limit > 0 && (
            <div className="w-full bg-surface-secondary rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  me.quota.percent >= 95 ? "bg-red-500" :
                  me.quota.percent >= 80 ? "bg-amber-500" : "bg-brand-500"
                }`}
                style={{ width: `${me.quota.percent}%` }}
              />
            </div>
          )}
          <p className="text-xs text-text-muted mt-2">
            {me.quota.limit < 0 ? "ไม่จำกัด" : `${me.quota.percent}% ใช้แล้ว`}
          </p>
        </div>

        {/* Plan Card */}
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">แพ็กเกจปัจจุบัน</p>
          <p className="text-2xl font-bold text-text-primary mb-1">{me.plan.label}</p>
          <p className="text-sm text-brand-600 font-semibold">
            {me.plan.priceThb === 0 ? "ฟรี" : `฿${me.plan.priceThb.toLocaleString()}/เดือน`}
          </p>
          {!isPaidPlan && (
            <Link href="/pricing" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
              อัปเกรดเพื่อรับโควต้าเพิ่ม →
            </Link>
          )}
          {me.plan.memoryLabel && (
            <p className="text-xs text-text-muted mt-1">Memory: {me.plan.memoryLabel}</p>
          )}
        </div>

        {/* Trial / Billing Card */}
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          {!isPaidPlan ? (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">ระยะเวลาทดลอง</p>
              <p className="text-2xl font-bold text-text-primary mb-1">{trialDays} วัน</p>
              <p className="text-sm text-text-muted">ที่เหลืออยู่</p>
              <p className="text-xs text-text-muted mt-1">ถึง {thDate(me.user.trialEndsAt)}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">รอบบิลถัดไป</p>
              <p className="text-2xl font-bold text-text-primary mb-1">
                ฿{(me.subscription?.totalThb ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-text-muted">ครบกำหนด {thDate(me.subscription?.currentPeriodEnd ?? null)}</p>
              <Link href="/dashboard/billing" className="mt-2 inline-block text-xs text-brand-600 hover:underline">
                ดูใบแจ้งหนี้ →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/bot"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-primary border border-border-default text-sm font-medium text-text-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            🤖 ตั้งค่าบอท
          </Link>
          <Link href="/dashboard/widget"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-primary border border-border-default text-sm font-medium text-text-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            💬 รับโค้ด Embed
          </Link>
          <Link href="/dashboard/billing"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-primary border border-border-default text-sm font-medium text-text-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            💳 Billing & ใบเสร็จ
          </Link>
          {(me.user.botState === "pending_kyc" || me.user.botState === "trial") && (
            <Link href="/dashboard/kyc"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-300 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
            >
              🔖 ยื่น KYC
            </Link>
          )}
          {(me.user.botState === "trial_expired" || me.user.botState === "suspended_payment") && (
            <Link href="/pricing"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              🚀 อัปเกรดแพ็กเกจ
            </Link>
          )}
        </div>
      </div>

      {/* ── Stats footer ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-primary border border-border-default rounded-2xl p-4 flex items-center gap-4">
          <span className="text-2xl">💬</span>
          <div>
            <p className="text-xs text-text-muted">ข้อความทั้งหมด</p>
            <p className="text-lg font-bold text-text-primary">{me.profile.totalMessageCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-surface-primary border border-border-default rounded-2xl p-4 flex items-center gap-4">
          <span className={`w-3 h-3 rounded-full ${me.profile.widgetEnabled ? "bg-green-500" : "bg-gray-400"}`} />
          <div>
            <p className="text-xs text-text-muted">สถานะ Widget</p>
            <p className="text-sm font-semibold text-text-primary">{me.profile.widgetEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</p>
            <Link href="/dashboard/widget" className="text-xs text-brand-600 hover:underline">ตั้งค่า →</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
