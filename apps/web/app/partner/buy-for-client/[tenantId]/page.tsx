"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  PLAN_CATALOG,
  QUOTA_ADDON_CATALOG,
  RETENTION_ADDON_CATALOG,
} from "@/lib/payment/pmRules";
import type { PlanId, QuotaAddonId, RetentionAddonId } from "@/lib/payment/pmRules";

// Plans shown to partner with partner-cost pricing from PackageConfig
interface PkgOption { packageId: string; label: string; partnerCost: number; msgPerMonth?: number }

const QUOTA_OPTIONS: { id: QuotaAddonId; label: string; note: string }[] = [
  { id: "none",      label: "ไม่เพิ่ม",             note: "ใช้โควต้าตาม Base Plan" },
  { id: "quota_1k",  label: "+1,000 ข้อความ/เดือน", note: "เหมาะสำหรับธุรกิจเล็ก" },
  { id: "quota_5k",  label: "+5,000 ข้อความ/เดือน", note: "คุ้มค่าที่สุด" },
  { id: "quota_20k", label: "+20,000 ข้อความ/เดือน", note: "ธุรกิจขนาดกลาง" },
];

const RETENTION_OPTIONS: { id: RetentionAddonId; label: string }[] = [
  { id: "standard", label: "7 วัน — มาตรฐาน (ฟรี)" },
  { id: "ret_30d",  label: "30 วัน" },
  { id: "ret_90d",  label: "90 วัน" },
];

function fmt(n: number) { return n.toLocaleString("th-TH"); }
function thb(n: number) { return `฿${fmt(n)}`; }

interface CurrentSub {
  planId:              string;
  status:              string;
  totalThb:            number;
  currentPeriodEnd?:   string;
  currentPeriodStart?: string;
}

export default function BuyForClientPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router       = useRouter();

  const [basePlans,    setBasePlans]    = useState<PkgOption[]>([]);
  const [memoryAddons, setMemoryAddons] = useState<PkgOption[]>([]);
  const [retAddons,    setRetAddons]    = useState<PkgOption[]>([]);
  const [clientName,   setClientName]  = useState("");
  const [currentSub,   setCurrentSub]  = useState<CurrentSub | null>(null);

  const [planId,      setPlanId]      = useState<PlanId>("starter");
  const [quotaId,     setQuotaId]     = useState<QuotaAddonId>("none");
  const [retId,       setRetId]       = useState<RetentionAddonId>("standard");

  const [loading,     setLoading]     = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error,       setError]       = useState("");

  // Fetch partner plans catalog + client current subscription
  useEffect(() => {
    Promise.all([
      fetch("/api/partner/plans").then((r) => r.json()),
      fetch(`/api/partner/clients/detail?tenantId=${tenantId}`).then((r) => r.json()),
    ]).then(([plans, clientDetail]) => {
      const bases = plans.basePlans ?? [];
      const mems  = plans.memoryAddons ?? [];
      const rets  = plans.retentionAddons ?? [];
      setBasePlans(bases);
      setMemoryAddons(mems);
      setRetAddons(rets);
      if (bases[0]) setPlanId(bases[0].packageId as PlanId);
      setClientName(clientDetail.businessName ?? clientDetail.name ?? tenantId);
      setCurrentSub(clientDetail.subscription ?? null);
    }).catch(() => {}).finally(() => setPageLoading(false));
  }, [tenantId]);

  // Compute partner-cost price
  const selBase = basePlans.find((p) => p.packageId === planId);
  const selQuota = memoryAddons.find((p) => p.packageId === quotaId);
  const selRet   = retAddons.find((p) => p.packageId === retId);

  // Retail prices for display (same layout as /checkout)
  const retailBase      = PLAN_CATALOG[planId]?.priceThb ?? 0;
  const retailQuota     = quotaId !== "none"     ? (QUOTA_ADDON_CATALOG[quotaId]?.priceThb ?? 0) : 0;
  const retailRetention = retId   !== "standard" ? (RETENTION_ADDON_CATALOG[retId]?.priceThb ?? 0) : 0;
  const retailSubtotal  = retailBase + retailQuota + retailRetention;

  // Partner cost prices
  const partnerBase      = selBase?.partnerCost ?? 0;
  const partnerQuota     = quotaId !== "none"     ? (selQuota?.partnerCost ?? 0) : 0;
  const partnerRetention = retId   !== "standard" ? (selRet?.partnerCost   ?? 0) : 0;
  const partnerSubtotal  = partnerBase + partnerQuota + partnerRetention;

  // Prorated credit for existing subscription
  let proratedCredit = 0;
  if (currentSub?.currentPeriodEnd && currentSub.status === "active") {
    const now   = Date.now();
    const end   = new Date(currentSub.currentPeriodEnd).getTime();
    const start = currentSub.currentPeriodStart
      ? new Date(currentSub.currentPeriodStart).getTime()
      : end - 30 * 24 * 60 * 60 * 1000;
    if (end > now) {
      const ratio = Math.max(0, Math.min(1, (end - now) / (end - start)));
      proratedCredit = Math.round((currentSub.totalThb ?? 0) * ratio);
    }
  }

  const chargePartner = Math.max(0, partnerSubtotal - proratedCredit);
  const vatPartner    = Math.round(chargePartner * 0.07);
  const totalPartner  = chargePartner + vatPartner;

  const isUpgrade = !!currentSub && currentSub.status === "active";

  async function handleCheckout() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/partner/buy-for-client", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, planId, quotaAddonId: quotaId, retentionAddonId: retId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary mb-2 inline-block">
          ← กลับ
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {isUpgrade ? "เปลี่ยนแพ็กเกจ" : "ซื้อแพ็กเกจ"} — {clientName}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          ราคาที่แสดงในส่วน &quot;ราคาลูกค้า&quot; คือราคาขายปลีก • ราคาที่คุณจ่ายจริงคือ &quot;ราคาทุนพาร์ทเนอร์&quot;
        </p>
      </div>

      {isUpgrade && currentSub && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          ลูกค้ามีแพ็กเกจ <strong>{currentSub.planId}</strong> อยู่แล้ว (หมดอายุ {currentSub.currentPeriodEnd ? new Date(currentSub.currentPeriodEnd).toLocaleDateString("th-TH") : "—"})
          &nbsp;— ระบบจะหักเครดิตสัดส่วนที่เหลือ{" "}
          <strong>{thb(proratedCredit)}</strong> ออกจากยอดชำระ
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* ── Left: Package selectors ──────────────────────────────── */}
        <div className="space-y-6">

          {/* 1. Base Plan */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">1. Base Plan</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {basePlans.map((p) => {
                const retail = PLAN_CATALOG[p.packageId as PlanId];
                const active = planId === p.packageId;
                return (
                  <button key={p.packageId} onClick={() => setPlanId(p.packageId as PlanId)}
                    className={["relative flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                      active ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-border-default bg-surface-secondary hover:border-brand-300",
                    ].join(" ")}>
                    <span className="font-heading font-bold text-text-primary">{p.label}</span>
                    <span className="text-xl font-extrabold text-brand-600 font-heading mt-1">
                      {thb(retail?.priceThb ?? 0)}
                    </span>
                    <span className="text-xs text-text-muted">/เดือน (ราคาลูกค้า)</span>
                    <span className="text-xs text-emerald-600 font-semibold mt-1.5">
                      ราคาทุน: {thb(p.partnerCost)}
                    </span>
                    {retail && "msgPerMonth" in retail && (
                      <span className="text-xs text-text-muted mt-1">
                        {(retail as { msgPerMonth: number }).msgPerMonth.toLocaleString()} ข้อความ/เดือน
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Quota Add-on */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">2. Quota Add-on (เพิ่มข้อความ/เดือน)</p>
            <div className="space-y-2.5">
              {QUOTA_OPTIONS.map(({ id, label, note }) => {
                const retail     = QUOTA_ADDON_CATALOG[id];
                const partnerPkg = memoryAddons.find((p) => p.packageId === id);
                const active     = quotaId === id;
                return (
                  <label key={id} className={["flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                    active ? "border-brand-500 bg-brand-50" : "border-border-default bg-surface-secondary hover:border-brand-300",
                  ].join(" ")}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="quota" checked={active} onChange={() => setQuotaId(id)} className="accent-brand-600" />
                      <div>
                        <span className="text-sm font-semibold text-text-primary">{label}</span>
                        <span className="text-xs text-text-muted ml-2">{note}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${retail.priceThb === 0 ? "text-emerald-500" : "text-text-primary"}`}>
                        {retail.priceThb === 0 ? "ฟรี" : `+${thb(retail.priceThb)}`}
                      </div>
                      {partnerPkg && partnerPkg.partnerCost > 0 && (
                        <div className="text-xs text-emerald-600 font-medium">ทุน: {thb(partnerPkg.partnerCost)}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Retention Add-on */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">3. Retention Add-on (ระยะเวลาเก็บข้อมูล)</p>
            <div className="space-y-2.5">
              {RETENTION_OPTIONS.map(({ id, label }) => {
                const retail     = RETENTION_ADDON_CATALOG[id];
                const partnerPkg = retAddons.find((p) => p.packageId === id);
                const active     = retId === id;
                return (
                  <label key={id} className={["flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                    active ? "border-brand-500 bg-brand-50" : "border-border-default bg-surface-secondary hover:border-brand-300",
                  ].join(" ")}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="ret" checked={active} onChange={() => setRetId(id)} className="accent-brand-600" />
                      <span className="text-sm font-medium text-text-primary">{label}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${retail.priceThb === 0 ? "text-emerald-500" : "text-text-primary"}`}>
                        {retail.priceThb === 0 ? "ฟรี" : `+${thb(retail.priceThb)}`}
                      </div>
                      {partnerPkg && partnerPkg.partnerCost > 0 && (
                        <div className="text-xs text-emerald-600 font-medium">ทุน: {thb(partnerPkg.partnerCost)}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Summary ───────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">
          {/* Retail price summary */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-5">ราคาลูกค้า (Retail)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Base Plan</span><span>{thb(retailBase)}</span></div>
              {retailQuota > 0 && <div className="flex justify-between"><span className="text-text-secondary">Quota Add-on</span><span>+{thb(retailQuota)}</span></div>}
              {retailRetention > 0 && <div className="flex justify-between"><span className="text-text-secondary">Retention</span><span>+{thb(retailRetention)}</span></div>}
              <div className="border-t border-border-default pt-2 flex justify-between font-semibold">
                <span>Subtotal</span><span>{thb(retailSubtotal)}</span>
              </div>
            </div>
          </div>

          {/* Partner cost summary */}
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-5">ยอดที่คุณจ่าย (ราคาทุน + VAT)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Base Plan</span><span>{thb(partnerBase)}</span></div>
              {partnerQuota > 0 && <div className="flex justify-between"><span className="text-text-secondary">Quota</span><span>+{thb(partnerQuota)}</span></div>}
              {partnerRetention > 0 && <div className="flex justify-between"><span className="text-text-secondary">Retention</span><span>+{thb(partnerRetention)}</span></div>}
              {proratedCredit > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>เครดิตที่เหลือ (Prorated)</span>
                  <span>-{thb(proratedCredit)}</span>
                </div>
              )}
              <div className="border-t border-brand-200 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-text-muted"><span>Subtotal</span><span>{thb(chargePartner)}</span></div>
                <div className="flex justify-between text-xs text-text-muted"><span>VAT 7%</span><span>+{thb(vatPartner)}</span></div>
              </div>
              <div className="border-t border-brand-200 pt-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-text-primary">รวมที่จ่าย</span>
                  <span className="text-2xl font-extrabold text-brand-600 font-heading">{thb(totalPartner)}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            <button onClick={handleCheckout} disabled={loading || basePlans.length === 0}
              className="mt-5 w-full py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังเชื่อมต่อ Stripe…
                </span>
              ) : isUpgrade ? "ชำระเงินและเปลี่ยนแพ็กเกจ →" : "ชำระเงินและเปิดใช้งาน →"}
            </button>
            <p className="text-center text-xs text-text-muted mt-3">🔒 ชำระผ่าน Stripe • ปลอดภัย 100%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
