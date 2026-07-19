"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calcVipPricing } from "@/lib/pricing/vipPricingUtils";
import {
  srv_expired_date_cal,
  dateToInputValue,
} from "@/lib/services/srv_expired_date_cal";
import { thb } from "@/lib/pricing/costPriceCalculator";
import {
  QuotaPackageDropdown,
  type ReadyPackageSummary,
} from "@/components/admin/QuotaPackageDropdown";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VipTenantDoc {
  _id: string;
  email: string;
  tenantId?: string;
  tenantName?: string;
  label: string;
  note?: string;
  baseAiQuota: number;
  storageAddonQuota: number;
  expiredAddonQuota: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  referenceScenarioId?: string;
  referenceScenarioLabel?: string;
  totalCostAr: number;
  customVipPrice: number;
  profitAmount: number;
  profitPct: number;
  vat7Amount: number;
  wht3Amount: number;
  autoRenew: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt?: string;
}

export interface ScenarioOption {
  _id: string;
  label: string;
  totalCostAr: number;
  plan?: string;
  packageName?: string;
}

export type VipTenantSavePayload = Omit<VipTenantDoc, "_id" | "profitAmount" | "profitPct" | "vat7Amount" | "wht3Amount" | "createdAt" | "createdBy">;

interface Props {
  mode: "create" | "edit";
  initial?: VipTenantDoc | null;
  scenarios: ScenarioOption[];
  onSave: (payload: VipTenantSavePayload) => Promise<void>;
  onClose: () => void;
}

function numInput(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const TODAY = dateToInputValue(new Date());

// ─── Helpers (defined outside component to preserve React identity across renders) ──

function inputCls(err?: string) {
  return `w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 ${
    err ? "border-red-400 bg-red-50" : "border-border-default bg-white"
  }`;
}

function Field({ label: lbl, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{lbl}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VipTenantModal({ mode, initial, scenarios, onSave, onClose }: Props) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [email,              setEmail]              = useState(initial?.email              ?? "");
  const [tenantId,           setTenantId]           = useState(initial?.tenantId           ?? "");
  const [tenantName,         setTenantName]         = useState(initial?.tenantName         ?? "");
  const [tenantLookupStatus, setTenantLookupStatus] = useState<"idle" | "found" | "not_found">("idle");
  const [label,              setLabel]              = useState(initial?.label              ?? "");
  const [note,               setNote]               = useState(initial?.note               ?? "");
  const [baseAiQuota,        setBaseAiQuota]        = useState(String(initial?.baseAiQuota        ?? 0));
  const [storageAddonQuota,  setStorageAddonQuota]  = useState(String(initial?.storageAddonQuota  ?? 0));
  const [expiredAddonQuota,  setExpiredAddonQuota]  = useState(String(initial?.expiredAddonQuota  ?? 0));
  const [startDate,          setStartDate]          = useState(initial?.startDate ? dateToInputValue(initial.startDate) : TODAY);
  const [endDate,            setEndDate]            = useState(initial?.endDate   ? dateToInputValue(initial.endDate)   : "");
  const [durationDays,       setDurationDays]       = useState(String(initial?.durationDays ?? ""));
  const [autoRenew,          setAutoRenew]          = useState(initial?.autoRenew ?? false);
  const [isActive,           setIsActive]           = useState(initial?.isActive  ?? true);

  // ── Pricing state ─────────────────────────────────────────────────────────
  const [scenarioId,         setScenarioId]         = useState(initial?.referenceScenarioId ?? "");
  const [costManual,         setCostManual]         = useState(String(initial?.totalCostAr    ?? 0));
  const [vipPrice,           setVipPrice]           = useState(String(initial?.customVipPrice ?? 0));

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Auto-fill cost from selected scenario ─────────────────────────────────
  const selectedScenario = useMemo(
    () => scenarios.find((s) => s._id === scenarioId) ?? null,
    [scenarios, scenarioId],
  );

  useEffect(() => {
    if (selectedScenario) {
      setCostManual(String(selectedScenario.totalCostAr));
    }
  }, [selectedScenario]);

  // ── Date two-way sync ─────────────────────────────────────────────────────
  function handleDurationChange(v: string) {
    setDurationDays(v);
    if (!v) return;
    const days = parseInt(v, 10);
    if (days > 0 && startDate) {
      const r = srv_expired_date_cal({ startDate, durationDays: days });
      if (r.isValid) setEndDate(dateToInputValue(r.endDate));
    }
  }

  function handleEndDateChange(v: string) {
    setEndDate(v);
    if (v && startDate) {
      const r = srv_expired_date_cal({ startDate, endDate: v });
      if (r.isValid) setDurationDays(String(r.durationDays));
    }
  }

  function handleStartDateChange(v: string) {
    setStartDate(v);
    if (durationDays) {
      const days = parseInt(durationDays, 10);
      if (days > 0 && v) {
        const r = srv_expired_date_cal({ startDate: v, durationDays: days });
        if (r.isValid) setEndDate(dateToInputValue(r.endDate));
      }
    } else if (endDate) {
      const r = srv_expired_date_cal({ startDate: v, endDate });
      if (r.isValid) setDurationDays(String(r.durationDays));
    }
  }

  // ── Tenant auto-detect ────────────────────────────────────────────────────
  const lookupTenant = useCallback(async (e: string) => {
    if (!e.includes("@")) { setTenantLookupStatus("idle"); return; }
    try {
      const res  = await fetch(`/api/admin/vip-tenants/lookup?email=${encodeURIComponent(e)}`);
      const data = await res.json() as { found: boolean; tenantId?: string; tenantName?: string };
      if (data.found) {
        setTenantId(data.tenantId ?? "");
        setTenantName(data.tenantName ?? "");
        setTenantLookupStatus("found");
      } else {
        setTenantId("");
        setTenantName("");
        setTenantLookupStatus("not_found");
      }
    } catch {
      setTenantLookupStatus("idle");
    }
  }, []);

  // Debounce lookup
  useEffect(() => {
    const t = setTimeout(() => void lookupTenant(email), 600);
    return () => clearTimeout(t);
  }, [email, lookupTenant]);

  // ── Derived pricing ───────────────────────────────────────────────────────
  const cost     = parseFloat(costManual) || 0;
  const price    = parseFloat(vipPrice)   || 0;
  const derived  = calcVipPricing(cost, price);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!email.includes("@"))     e.email        = "Email ต้องมีสัญลักษณ์ @";
    if (!label.trim())            e.label        = "กรุณาระบุชื่อ Deal";
    if (!startDate)               e.startDate    = "กรุณาระบุวันที่เริ่มต้น";
    if (!endDate)                 e.endDate      = "กรุณาระบุวันที่สิ้นสุด (หรือกรอกจำนวนวัน)";
    if (!durationDays || parseInt(durationDays, 10) <= 0)
                                  e.durationDays = "จำนวนวันต้องมากกว่า 0";
    if (parseInt(baseAiQuota, 10)       < 0) e.baseAiQuota       = "ต้องเป็นตัวเลขบวก";
    if (parseInt(storageAddonQuota, 10) < 0) e.storageAddonQuota = "ต้องเป็นตัวเลขบวก";
    if (parseInt(expiredAddonQuota, 10) < 0) e.expiredAddonQuota = "ต้องเป็นตัวเลขบวก";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        email: email.trim().toLowerCase(),
        tenantId:               tenantId     || undefined,
        tenantName:             tenantName   || undefined,
        label:                  label.trim(),
        note:                   note.trim()  || undefined,
        baseAiQuota:            numInput(baseAiQuota),
        storageAddonQuota:      numInput(storageAddonQuota),
        expiredAddonQuota:      numInput(expiredAddonQuota),
        startDate,
        endDate,
        durationDays:           parseInt(durationDays, 10),
        referenceScenarioId:    scenarioId || undefined,
        referenceScenarioLabel: selectedScenario?.label ?? undefined,
        totalCostAr:            cost,
        customVipPrice:         price,
        autoRenew,
        isActive,
      });
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-4xl flex flex-col my-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default flex-shrink-0">
          <div>
            <h2 className="font-heading font-bold text-text-primary text-lg">
              {mode === "create" ? "➕ เพิ่ม VIP Tenant" : "✏️ แก้ไข VIP Tenant"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">กำหนดสิทธิ์พิเศษและราคาสำหรับ Tenant นี้</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">✕</button>
        </div>

        {/* Body — 2 columns */}
        <div className="flex flex-col lg:flex-row gap-0 flex-1 overflow-hidden">

          {/* ── Left: Form ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Email */}
            <Field label="📧 Email Account *" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="business@example.com"
                className={inputCls(errors.email)}
              />
              {tenantLookupStatus === "found" && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✓ พบ Tenant: <strong>{tenantName || tenantId}</strong>
                </p>
              )}
              {tenantLookupStatus === "not_found" && (
                <p className="text-xs text-amber-500">⚠ ไม่พบ Tenant ในระบบ — จะสร้าง record ใหม่</p>
              )}
            </Field>

            {/* Label */}
            <Field label="📋 ชื่อ Deal / Label *" error={errors.label}>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="เช่น Enterprise Trial Q3 2026"
                className={inputCls(errors.label)}
              />
            </Field>

            <div className="border-t border-border-default" />

            {/* Quota */}
            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">Quota ที่ได้รับ</p>

            {/* ── Dropdown เลือกจากแพ็กเกจสำเร็จรูป ── */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                📦 เลือกจากแพ็กเกจสำเร็จรูป
              </label>
              <QuotaPackageDropdown
                currentQuota={baseAiQuota}
                onSelect={(pkg: ReadyPackageSummary) => {
                  // นำ quota จากแพ็กเกจที่เลือกมาใส่ field อัตโนมัติ
                  setBaseAiQuota(String(pkg.totalMessageQuota));
                  // storage และ expired ยังคงให้กรอกเองได้
                }}
              />
              {Number(baseAiQuota) > 0 && (
                <p className="text-[10px] text-emerald-600 font-medium">
                  ✓ ใช้ Base AI Quota: <strong>{Number(baseAiQuota).toLocaleString()}</strong> msg จากแพ็กเกจที่เลือก (แก้ไขด้านล่างได้)
                </p>
              )}
            </div>

            {/* ── กรอกตัวเลข quota โดยตรง (ยังคงแก้ไขได้) ── */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="🤖 Base AI" error={errors.baseAiQuota}>
                <input type="number" min={0} step={1}
                  value={baseAiQuota}
                  onChange={(e) => setBaseAiQuota(e.target.value)}
                  className={inputCls(errors.baseAiQuota)} />
              </Field>
              <Field label="💾 Storage Add-on" error={errors.storageAddonQuota}>
                <input type="number" min={0} step={1}
                  value={storageAddonQuota}
                  onChange={(e) => setStorageAddonQuota(e.target.value)}
                  className={inputCls(errors.storageAddonQuota)} />
              </Field>
              <Field label="🗂 Expired Add-on" error={errors.expiredAddonQuota}>
                <input type="number" min={0} step={1}
                  value={expiredAddonQuota}
                  onChange={(e) => setExpiredAddonQuota(e.target.value)}
                  className={inputCls(errors.expiredAddonQuota)} />
              </Field>
            </div>
            <p className="text-[10px] text-text-muted -mt-2">
              💡 เลือกแพ็กเกจด้านบนเพื่อ auto-fill Base AI หรือกรอกตัวเลขเองได้โดยตรง
            </p>

            <div className="border-t border-border-default" />

            {/* Duration */}
            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">ระยะเวลาใช้งาน</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="📅 วันที่เริ่มต้น *" error={errors.startDate}>
                <input type="date" value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={inputCls(errors.startDate)} />
              </Field>
              <Field label="⏳ จำนวนวัน" error={errors.durationDays}>
                <input type="number" min={1} step={1} placeholder="เช่น 30"
                  value={durationDays}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className={inputCls(errors.durationDays)} />
                <p className="text-[10px] text-text-muted">กรอกวันแล้วระบบคำนวณวันหมดอายุให้</p>
              </Field>
            </div>
            <Field label="📅 วันที่สิ้นสุด *" error={errors.endDate}>
              <input type="date" value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={inputCls(errors.endDate)} />
              <p className="text-[10px] text-text-muted">หรือกรอกวันหมดอายุแล้วระบบคำนวณจำนวนวันให้</p>
            </Field>

            <div className="border-t border-border-default" />

            {/* Note + Options */}
            <Field label="📝 Note (internal)" error={undefined}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="หมายเหตุภายในสำหรับ admin..."
                className={`${inputCls()} resize-none`}
              />
            </Field>

            <div className="flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-text-secondary">🔄 Auto-renew</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-text-secondary">✅ Active</span>
              </label>
            </div>
          </div>

          {/* ── Right: Pricing Panel (sticky) ─────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0 bg-surface-secondary border-t lg:border-t-0 lg:border-l border-border-default">
            <div className="sticky top-0 px-5 py-5 space-y-4">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">💰 ราคาและต้นทุน</p>

              {/* Scenario picker (Approach A) */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text-secondary">Scenario อ้างอิง</label>
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="">— กรอกต้นทุนเอง (Approach C) —</option>
                  {scenarios.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.label} ({thb(s.totalCostAr)})
                    </option>
                  ))}
                </select>
                {selectedScenario && (
                  <p className="text-[10px] text-emerald-600">✓ ต้นทุนจาก Scenario ถูกดึงมาให้แล้ว</p>
                )}
              </div>

              {/* Cost input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text-secondary">
                  ต้นทุน (totalCostAr) ฿
                </label>
                <input
                  type="number" min={0} step={0.01}
                  value={costManual}
                  onChange={(e) => { setScenarioId(""); setCostManual(e.target.value); }}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                {selectedScenario && (
                  <p className="text-[10px] text-text-muted">แก้ไขเพื่อ override ค่าจาก scenario</p>
                )}
              </div>

              {/* VIP price input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text-secondary">
                  ราคา VIP (customVipPrice) ฿
                </label>
                <input
                  type="number" min={0} step={1}
                  value={vipPrice}
                  onChange={(e) => setVipPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-amber-300 rounded-xl bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* Calculated summary */}
              <div className="rounded-xl border border-border-default overflow-hidden bg-white text-xs">
                <div className="bg-surface-secondary px-3 py-2 font-semibold text-text-muted text-[10px] uppercase">
                  สรุปการคำนวณ
                </div>
                {[
                  { label: "ต้นทุน",       value: thb(cost),                  cls: "text-red-500 font-mono" },
                  { label: "ราคา VIP",      value: thb(price),                 cls: "text-brand-600 font-mono font-bold" },
                  { label: "กำไร",          value: `${thb(derived.profitAmount)} (${derived.profitPct.toFixed(1)}%)`,
                    cls: derived.profitAmount >= 0 ? "text-emerald-600 font-mono" : "text-red-500 font-mono" },
                  { label: "VAT 7%",        value: thb(derived.vat7Amount),    cls: "text-text-muted font-mono" },
                  { label: "WHT 3%",        value: thb(derived.wht3Amount),    cls: "text-text-muted font-mono" },
                ].map(({ label: l, value, cls }) => (
                  <div key={l} className="px-3 py-2 flex justify-between border-t border-border-default">
                    <span className="text-text-muted">{l}</span>
                    <span className={cls}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Profit warning */}
              {price > 0 && derived.profitAmount < 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  ⚠ ราคา VIP ต่ำกว่าต้นทุน — ขาดทุน {thb(Math.abs(derived.profitAmount))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default flex justify-end gap-3 flex-shrink-0">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button" disabled={saving} onClick={() => void handleSave()}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "กำลังบันทึก..." : mode === "create" ? "💾 บันทึก VIP Tenant" : "💾 อัปเดต"}
          </button>
        </div>
      </div>
    </div>
  );
}
