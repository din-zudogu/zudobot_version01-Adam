"use client";

import { useEffect, useMemo, useState } from "react";
import { thb } from "@/lib/pricing/costPriceCalculator";
import {
  ftc_build_ready_package_spec,
  ftc_calc_auto_prices,
  ftc_calc_profit,
  ftc_validate_prices,
  STANDARD_FEATURES,
} from "@/lib/pricing/readyPackageSpec";
import type { CostPriceScenarioDoc } from "./CostPriceFormModal";

// ── types ──────────────────────────────────────────────────────────

export type ReadyPackageItem = {
  scenarioId: string;
  plan: string;
  packageName: string;
  bestPriceZudobot: number;
  bestPricePartner: number;
  vat7Zudobot: number;
  wht3Zudobot: number;
  vat7Partner: number;
  wht3Partner: number;
  /** ต้นทุนจริง Production (AR column จาก scenario.calculated) */
  totalCostAr?: number;
  messageCount?: number;
  tokensPerMessage?: number;
  historyTokenCount?: number;
  storageMbPerSentence?: number;
  storageExpireDays?: number;
  trialDurationDays?: number;
};

export type ReadyPackageDoc = {
  _id: string;
  name: string;
  items: ReadyPackageItem[];
  finalRetailPrice?: number;
  finalPartnerPrice?: number;
  isActive: boolean;
  isOnSale: boolean;
  isTrial: boolean;
  trialDays?: number;
  /** ตลอดชีพ — ไม่มีวันหมดอายุ (เมื่อ isTrial=true เท่านั้น) */
  isLifetime?: boolean;
  isPartnerAllowed: boolean;
  /** โควต้าจำนวนร้านค้าที่ใช้ได้ — 0 = ไม่จำกัด */
  maxShops?: number;
  /** จำกัดเฉพาะร้านค้าใหม่ (สมัครใหม่) เท่านั้น */
  newShopsOnly?: boolean;
  /** จำนวนร้านค้าที่ใช้แพคเกจนี้อยู่ (read-only จาก backend) */
  usedShops?: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

type SavePayload = {
  name: string;
  items: Array<{ scenarioId: string }>;
  finalRetailPrice?: number;
  finalPartnerPrice?: number;
  isActive: boolean;
  isOnSale: boolean;
  isTrial: boolean;
  trialDays?: number;
  isLifetime?: boolean;
  isPartnerAllowed: boolean;
  maxShops: number;
  newShopsOnly: boolean;
  sortOrder: number;
};

type Props = {
  mode: "create" | "edit";
  initial?: ReadyPackageDoc | null;
  scenarios: CostPriceScenarioDoc[];
  /** รายการ ReadyPackage ทั้งหมด — ใช้ตรวจสอบ sortOrder ซ้ำ */
  existingPackages?: ReadyPackageDoc[];
  onSave: (payload: SavePayload) => Promise<void>;
  onClose: () => void;
};

const EMPTY_ITEM: ReadyPackageItem = {
  scenarioId: "", plan: "", packageName: "",
  bestPriceZudobot: 0, bestPricePartner: 0,
  vat7Zudobot: 0, wht3Zudobot: 0, vat7Partner: 0, wht3Partner: 0,
};

function scenarioLabel(s: CostPriceScenarioDoc): string {
  const pkg = s.inputs.packageName ? ` · ${s.inputs.packageName}` : "";
  const mo  = s.inputs.aiBaseMonths > 0 ? ` (${s.inputs.aiBaseMonths} เดือน)` : "";
  return `${s.inputs.plan}${pkg}${mo} — ${thb(s.inputs.bestPriceZudobot)}`;
}

function pct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

// ── component ──────────────────────────────────────────────────────

export function ReadyPackageModal({ mode, initial, scenarios, existingPackages = [], onSave, onClose }: Props) {
  const [name, setName]           = useState(initial?.name ?? "");
  const [isActive, setIsActive]   = useState(initial?.isActive ?? true);
  const [isOnSale, setIsOnSale]   = useState(initial?.isOnSale ?? true);
  const [isTrial, setIsTrial]           = useState(initial?.isTrial ?? false);
  const [trialDays, setTrialDays]       = useState<number>(initial?.trialDays ?? 14);
  const [isLifetime, setIsLifetime]     = useState<boolean>(initial?.isLifetime ?? false);
  const [isPartnerAllowed, setIsPartnerAllowed] = useState(initial?.isPartnerAllowed ?? true);
  const [maxShops, setMaxShops]   = useState<number>(initial?.maxShops ?? 0);
  const [newShopsOnly, setNewShopsOnly] = useState<boolean>(initial?.newShopsOnly ?? false);
  const usedShops = initial?.usedShops ?? 0;
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [guideProfitPct, setGuideProfitPct] = useState(40);

  const [items, setItems] = useState<ReadyPackageItem[]>(
    initial?.items?.length ? initial.items : [{ ...EMPTY_ITEM }],
  );

  const selectedIds = new Set(items.map((i) => i.scenarioId).filter(Boolean));
  const validItems  = items.filter((i) => i.scenarioId);

  // ตรวจสอบ sortOrder ซ้ำ
  // อนุญาตซ้ำได้ก็ต่อเมื่อ รายการที่ซ้ำ มีสถานะ inactive หรือ ไม่ขาย
  const sortOrderConflict = useMemo(() => {
    return existingPackages.find((p) => {
      if (p._id === initial?._id) return false; // ข้ามตัวเองเมื่อ edit
      if (p.sortOrder !== sortOrder) return false;
      return p.isActive && p.isOnSale; // conflict เฉพาะเมื่อรายการนั้น active AND on sale
    }) ?? null;
  }, [existingPackages, sortOrder, initial?._id]);

  // ── auto prices ──────────────────────────────────────────────────
  const auto = useMemo(() => ftc_calc_auto_prices(validItems), [validItems]);

  // ── final price state ────────────────────────────────────────────
  // Use explicit user-modified flags instead of value comparison to avoid
  // the 0-is-falsy bug: `parseFloat("0") || fallback` would silently use fallback
  const [retailInput, setRetailInput]     = useState<string>("");
  const [partnerInput, setPartnerInput]   = useState<string>("");
  const [userModifiedRetail, setUserModifiedRetail]   = useState(false);
  const [userModifiedPartner, setUserModifiedPartner] = useState(false);

  // Initialise from initial doc or auto — only on first mount (no re-init on auto change)
  useEffect(() => {
    if (initial?.finalRetailPrice  != null) {
      setRetailInput(String(initial.finalRetailPrice));
      setUserModifiedRetail(true);   // treat persisted custom price as "modified"
    } else {
      setRetailInput(String(auto.autoRetail));
    }
    if (initial?.finalPartnerPrice != null) {
      setPartnerInput(String(initial.finalPartnerPrice));
      setUserModifiedPartner(true);
    } else {
      setPartnerInput(String(auto.autoPartner));
    }
  // Run once on mount only; auto values settle immediately from items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse safely: parseFloat("0") = 0 (valid), NaN → fallback to auto
  const finalRetail  = Number.isFinite(parseFloat(retailInput))
    ? parseFloat(retailInput) : auto.autoRetail;
  const finalPartner = Number.isFinite(parseFloat(partnerInput))
    ? parseFloat(partnerInput) : auto.autoPartner;

  const isPriceModified = userModifiedRetail || userModifiedPartner;

  function resetToAuto() {
    setRetailInput(String(isTrial ? 0 : auto.autoRetail));
    setPartnerInput(String(isTrial ? 0 : auto.autoPartner));
    setUserModifiedRetail(false);
    setUserModifiedPartner(false);
  }

  function handleSetIsTrial(checked: boolean) {
    setIsTrial(checked);
    if (checked) {
      // Trial → ราคา 0 บาทเสมอ
      setRetailInput("0");
      setPartnerInput("0");
      setUserModifiedRetail(false);
      setUserModifiedPartner(false);
    } else {
      // ปลด Trial → คืน auto price
      setRetailInput(String(auto.autoRetail));
      setPartnerInput(String(auto.autoPartner));
      setUserModifiedRetail(false);
      setUserModifiedPartner(false);
      setIsLifetime(false);
    }
  }

  // ── profit + validation ──────────────────────────────────────────
  const profit   = ftc_calc_profit(finalRetail, finalPartner, auto.costRetail, auto.costPartner, auto.realCostAr);
  const validity = ftc_validate_prices(finalRetail, finalPartner, auto.costRetail, auto.costPartner, auto.realCostAr);

  // ── item operations ──────────────────────────────────────────────
  function updateItem(index: number, scenarioId: string) {
    const s = scenarios.find((sc) => sc._id === scenarioId);
    setItems((prev) =>
      prev.map((item, i) =>
        i !== index ? item : s ? {
          scenarioId: s._id,
          plan: s.inputs.plan,
          packageName: s.inputs.packageName ?? "",
          bestPriceZudobot: s.inputs.bestPriceZudobot ?? 0,
          bestPricePartner: s.inputs.bestPricePartner ?? 0,
          vat7Zudobot: s.calculated.vat7Zudobot,
          wht3Zudobot: s.calculated.wht3Zudobot,
          vat7Partner: s.calculated.vat7Partner,
          wht3Partner: s.calculated.wht3Partner,
          totalCostAr:          s.calculated.totalCostAr ?? s.calculated.monthlyTotalCost,
          messageCount:         s.inputs.messageCount,
          tokensPerMessage:     s.inputs.tokensPerMessage,
          historyTokenCount:    s.inputs.historyTokenCount,
          storageMbPerSentence: s.inputs.storageMbPerSentence,
          storageExpireDays:    s.inputs.storageExpireDays,
          trialDurationDays:    s.inputs.trialDurationDays,
        } : { ...EMPTY_ITEM },
      ),
    );
  }

  function addItem()               { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }

  // Trial package อนุญาตให้บันทึกได้เสมอ (ราคา 0 คือตั้งใจ ไม่ผ่าน profit validation)
  // sortOrderConflict ป้องกันบันทึกเมื่อเลขลำดับซ้ำกับรายการที่ active+onSale
  const canSave = name.trim().length > 0 && validItems.length > 0
    && (isTrial || validity.canSave)
    && !sortOrderConflict;

  function buildPayload(): SavePayload {
    return {
      name: name.trim(),
      items: validItems.map((i) => ({ scenarioId: i.scenarioId })),
      // Trial package → ราคา 0 เสมอ; ไม่บันทึก custom price
      finalRetailPrice:  isTrial ? 0 : (isPriceModified ? finalRetail  : undefined),
      finalPartnerPrice: isTrial ? 0 : (isPriceModified ? finalPartner : undefined),
      isActive,
      isOnSale,
      isTrial,
      trialDays: isTrial && !isLifetime ? trialDays : undefined,
      isLifetime: isTrial ? isLifetime : undefined,
      isPartnerAllowed,
      maxShops: Math.max(0, Math.floor(maxShops || 0)),
      newShopsOnly,
      sortOrder,
    };
  }

  async function handleSaveClick() {
    if (!canSave) return;
    // Trial: ราคา 0 คือตั้งใจ — ไม่ต้องถามยืนยัน
    if (!isTrial && isPriceModified) { setShowConfirm(true); return; }
    setSaving(true);
    await onSave(buildPayload());
    setSaving(false);
  }

  async function handleConfirmSave() {
    setShowConfirm(false);
    setSaving(true);
    await onSave(buildPayload());
    setSaving(false);
  }

  // ── profit color ─────────────────────────────────────────────────
  function profitColor(ok: boolean, warn: boolean): string {
    if (!ok)   return "text-red-600 font-semibold";
    if (warn)  return "text-amber-600 font-semibold";
    return "text-emerald-600 font-semibold";
  }

  // ── render ────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
        <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-heading font-bold text-text-primary">
                {mode === "create" ? "สร้างแพคเกจสำเร็จรูป" : "แก้ไขแพคเกจสำเร็จรูป"}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                เลือก Plan/Package ได้หลายรายการ — ระบบคำนวณสเปคและราคาอัตโนมัติ
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-xl text-text-muted hover:text-text-primary">×</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* ชื่อ + ลำดับ */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  ชื่อแพคเกจสำเร็จรูป <span className="text-red-500">*</span>
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น AI Base Starter รายเดือน"
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">เลขลำดับแสดงผล</label>
                <input type="number" value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm" />
                <p className="text-[10px] text-text-muted mt-0.5">น้อย = แสดงก่อน</p>
                {sortOrderConflict && (
                  <p className="text-[10px] text-red-600 mt-0.5 font-medium">
                    ⚠ เลขลำดับ {sortOrder} ซ้ำกับ &quot;{sortOrderConflict.name}&quot; ที่กำลัง Active + เปิดขายอยู่
                  </p>
                )}
              </div>
            </div>

            {/* สถานะ */}
            <div className="border border-border-default rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-text-primary">สถานะ</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-brand-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">ใช้งาน (Active)</p>
                    <p className="text-xs text-text-muted">เปิดรายการนี้ในระบบ</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={isOnSale} onChange={(e) => setIsOnSale(e.target.checked)} className="accent-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">เปิดขาย (On Sale)</p>
                    <p className="text-xs text-text-muted">ตั้ง Active+เปิดขายให้ทุก Plan/Package ที่เลือก</p>
                  </div>
                </label>
              </div>
            </div>

            {/* สถานะ Trial */}
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={isTrial} onChange={(e) => handleSetIsTrial(e.target.checked)}
                  className="accent-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">เป็นแพคเกจทดลองใช้ (Trial) — ราคา ฿0.00</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    ราคา Retail และ Partner จะถูกกำหนดเป็น ฿0.00 เสมอ · ระบบแจ้งเตือนก่อนครบกำหนด
                  </p>
                </div>
              </label>
              {isTrial && (
                <div className="pl-7 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={isLifetime} onChange={(e) => setIsLifetime(e.target.checked)}
                      className="accent-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">ตลอดชีพ (Lifetime) — ไม่มีวันหมดอายุ</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        ทำงานได้ตลอดไป ไม่นับวันหมดอายุ — ไม่สนใจจำนวนวันทดลองใช้ด้านล่าง
                      </p>
                    </div>
                  </label>
                  {!isLifetime && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-amber-800 shrink-0">จำนวนวันทดลองใช้</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={trialDays}
                        onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-24 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm font-mono"
                      />
                      <span className="text-sm font-semibold text-amber-800">วัน</span>
                      <span className="text-xs text-amber-600">
                        (~{Math.round(trialDays / 30 * 10) / 10} เดือน)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Partner permission */}
            <div className="border border-border-default rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-text-primary">สิทธิ์ Partner</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={isPartnerAllowed}
                  onChange={(e) => setIsPartnerAllowed(e.target.checked)}
                  className="accent-brand-600 mt-0.5" />
                <div>
                  <p className="text-sm text-text-secondary">อนุญาตให้ Partner ขายได้</p>
                  <p className="text-xs text-text-muted">
                    {isPartnerAllowed ? "Partner สามารถนำเสนอแพคเกจนี้ให้ลูกค้าได้" : "เฉพาะ Zudobot เท่านั้นที่ขายได้"}
                  </p>
                </div>
              </label>
            </div>

            {/* โควต้าจำนวนร้านค้า */}
            <div className="border border-border-default rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-text-primary">โควต้าจำนวนร้านค้า</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={maxShops}
                  onChange={(e) => setMaxShops(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-28 bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm font-mono"
                />
                <span className="text-sm text-text-secondary">ร้านค้า</span>
                <span className="text-xs text-text-muted">
                  {maxShops > 0 ? `จำกัด ${maxShops.toLocaleString()} ร้าน` : "0 = ไม่จำกัด (unlimited)"}
                </span>
              </div>
              <p className="text-[10px] text-text-muted">
                นับแบบ &quot;ใช้แล้วใช้เลย&quot; — ร้านที่เคยรับแพคเกจถูกนับถาวร ไม่คืนสิทธิ์เมื่อยกเลิก
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-border-default mt-1">
                <input type="checkbox" checked={newShopsOnly}
                  onChange={(e) => setNewShopsOnly(e.target.checked)}
                  className="accent-brand-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">เฉพาะร้านค้าใหม่ (สมัครใหม่) เท่านั้น</p>
                  <p className="text-xs text-text-muted">
                    {newShopsOnly
                      ? "ร้านที่เคยเป็นลูกค้าชำระเงินแล้วจะรับแพคเกจนี้ไม่ได้ — สำหรับโปรฯ เช่น “100 ร้านแรก”"
                      : "เปิดเพื่อจำกัดเฉพาะร้านที่ยังไม่เคยชำระเงิน"}
                  </p>
                </div>
              </label>
              {mode === "edit" && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1">
                  <span className="text-text-muted">
                    ใช้ไปแล้ว: <strong className="text-text-primary">{usedShops.toLocaleString()}</strong> ร้าน
                  </span>
                  <span className="text-text-muted">
                    คงเหลือ:{" "}
                    <strong className={maxShops > 0 && usedShops >= maxShops ? "text-red-600" : "text-emerald-600"}>
                      {maxShops > 0 ? Math.max(0, maxShops - usedShops).toLocaleString() : "ไม่จำกัด"}
                    </strong>
                    {maxShops > 0 ? " ร้าน" : ""}
                  </span>
                  {maxShops > 0 && usedShops > maxShops && (
                    <span className="text-red-600 font-medium">⚠ ใช้เกินโควต้าที่ตั้งไว้</span>
                  )}
                </div>
              )}
            </div>

            {/* รายการ Plan/Package */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-text-primary">
                  รายการ Plan/Package <span className="text-red-500">*</span>
                  <span className="font-normal text-text-muted ml-2">(เลือกได้หลายรายการ ไม่ซ้ำกัน)</span>
                </p>
                <button type="button" onClick={addItem} className="text-xs text-brand-600 hover:underline font-medium">+ เพิ่มรายการ</button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const availableScenarios = scenarios.filter((s) => !selectedIds.has(s._id) || s._id === item.scenarioId);
                  const selectedScenario   = scenarios.find((s) => s._id === item.scenarioId);
                  return (
                    <div key={index} className="border border-border-default rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary">
                        <span className="text-xs text-text-muted font-medium w-5 text-center">{index + 1}</span>
                        <select value={item.scenarioId} onChange={(e) => updateItem(index, e.target.value)}
                          className="flex-1 bg-white border border-border-default rounded-lg px-3 py-1.5 text-sm">
                          <option value="">— เลือก Plan/Package —</option>
                          {availableScenarios.map((s) => (
                            <option key={s._id} value={s._id}>{scenarioLabel(s)}</option>
                          ))}
                        </select>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none px-1" title="นำออก">×</button>
                        )}
                      </div>
                      {item.scenarioId && selectedScenario ? (
                        <div className="px-3 py-2 space-y-2 text-xs">
                          {(() => {
                            const spec = ftc_build_ready_package_spec(selectedScenario);
                            return (
                              <div className={`rounded-lg px-3 py-2 border ${spec.colorClass}`}>
                                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">{spec.typeLabel}</p>
                                <div className="space-y-0.5 mb-2">
                                  {spec.specLines.map((line, li) => (
                                    <div key={li} className="flex justify-between gap-4">
                                      <span className={line.warning ? "text-red-600 font-medium" : "text-text-muted"}>{line.label}</span>
                                      <span className={`font-semibold text-right ${line.warning ? "text-red-700" : ""}`}>{line.value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="border-t border-black/10 pt-1.5 mt-1.5">
                                  <p className="text-[10px] font-semibold text-text-muted mb-1">สิทธิ์พื้นฐานที่ได้รับ</p>
                                  <ul className="space-y-0.5">
                                    {STANDARD_FEATURES.map((f, fi) => (
                                      <li key={fi} className="flex items-center gap-1.5 text-text-secondary">
                                        <span className="text-emerald-500 font-bold">✓</span> {f}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })()}
                          {selectedScenario.packageDescription && (
                            <div className="bg-surface-secondary rounded-lg px-3 py-2 text-text-secondary leading-relaxed border border-border-default">
                              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">คำอธิบายเพิ่มเติม</p>
                              {selectedScenario.packageDescription}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 bg-surface-secondary rounded-lg px-3 py-2 border border-border-default">
                            <div>
                              <p className="text-[10px] text-text-muted uppercase font-semibold mb-0.5">ต้นทุนจริง (AR)</p>
                              <p className="font-mono font-bold text-orange-600">
                                {item.totalCostAr != null ? thb(item.totalCostAr) : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-text-muted uppercase font-semibold mb-0.5">Retail รวม WHT 3%</p>
                              <p className="font-mono font-bold text-brand-600">{thb(item.bestPriceZudobot + item.wht3Zudobot)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-text-muted uppercase font-semibold mb-0.5">Partner รวม WHT 3%</p>
                              <p className="font-mono font-semibold text-text-secondary">{thb(item.bestPricePartner + item.wht3Partner)}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="px-3 py-2 text-xs text-text-muted italic">เลือก Plan/Package เพื่อดูสเปคและราคาอัตโนมัติ</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={addItem}
                className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-border-default text-xs text-text-muted hover:border-brand-400 hover:text-brand-600 transition-colors">
                + เพิ่ม Plan/Package
              </button>

              {/* ต้นทุนอ้างอิง */}
              {validItems.length > 0 && (
                <div className="mt-3 rounded-xl border border-border-default bg-surface-secondary px-4 py-2 space-y-1.5 text-xs">
                  {/* breakdown ต้นทุนจริงรายแพลน */}
                  {validItems.some((i) => i.totalCostAr != null) && (
                    <div className="space-y-1 pb-1.5 border-b border-border-default">
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">ต้นทุนจริง (AR) แยกตาม Plan</p>
                      {validItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-text-muted truncate max-w-[65%]">
                            {item.plan}{item.packageName ? ` · ${item.packageName}` : ""}
                          </span>
                          <span className="font-mono text-orange-600 font-semibold">
                            {item.totalCostAr != null ? thb(item.totalCostAr) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {auto.realCostAr > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted font-semibold">ต้นทุนจริง (AR รวมทุก item)</span>
                      <span className="font-mono font-bold text-orange-700">{thb(auto.realCostAr)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-muted">
                    <span>ราคาขายรวม Retail + WHT (floor auto)</span>
                    <span className="font-mono">{thb(auto.costRetail)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>ราคาขายรวม Partner + WHT (floor auto)</span>
                    <span className="font-mono">{thb(auto.costPartner)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Final Price for Sell (ซ่อนเมื่อ Trial เพราะราคา 0 เสมอ) ─── */}
            {validItems.length > 0 && !isTrial && (
              <div className="border-2 border-brand-200 rounded-xl overflow-hidden">
                <div className="bg-brand-50 px-4 py-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-800">💰 ราคาขายสุดท้าย (Final Price for Sell)</p>
                  {isPriceModified && (
                    <button type="button" onClick={resetToAuto}
                      className="text-xs text-brand-600 hover:underline font-medium">
                      ↺ Reset เป็น auto
                    </button>
                  )}
                </div>
                <div className="px-4 py-3 space-y-3 text-xs bg-white">
                  {/* marketing context */}
                  <div className="flex items-center justify-between text-text-muted">
                    <span>ซื้อแยก (sum ของแต่ละ item): <strong>{thb(auto.sumRetail)}</strong></span>
                    <span className="text-brand-600 font-semibold">
                      แพคเกจนี้: {thb(finalRetail)} {auto.sumRetail > finalRetail ? `(ประหยัด ${thb(auto.sumRetail - finalRetail)})` : ""}
                    </span>
                  </div>

                  {/* Price inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Final Retail (฿)</label>
                      <input type="number" value={isTrial ? "0" : retailInput}
                        disabled={isTrial}
                        onChange={(e) => { setRetailInput(e.target.value); setUserModifiedRetail(true); }}
                        className={`w-full bg-surface-secondary border rounded-lg px-3 py-2 text-sm font-mono ${isTrial ? "border-amber-300 text-amber-700 cursor-not-allowed opacity-75" : userModifiedRetail ? "border-brand-400 ring-1 ring-brand-200" : "border-border-default"}`} />
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {isTrial ? "Trial = ฿0.00 เสมอ" : `auto: ${thb(auto.autoRetail)}`}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Final Partner (฿)</label>
                      <input type="number" value={isTrial ? "0" : partnerInput}
                        disabled={isTrial}
                        onChange={(e) => { setPartnerInput(e.target.value); setUserModifiedPartner(true); }}
                        className={`w-full bg-surface-secondary border rounded-lg px-3 py-2 text-sm font-mono ${isTrial ? "border-amber-300 text-amber-700 cursor-not-allowed opacity-75" : userModifiedPartner ? "border-brand-400 ring-1 ring-brand-200" : "border-border-default"}`} />
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {isTrial ? "Trial = ฿0.00 เสมอ" : `auto: ${thb(auto.autoPartner)}`}
                      </p>
                    </div>
                  </div>

                  {/* Pricing Guide */}
                  {auto.realCostAr > 0 && (() => {
                    const guidePrice = guideProfitPct < 100
                      ? Math.ceil(auto.realCostAr / (1 - guideProfitPct / 100) / 100) * 100
                      : 0;
                    return (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">📐 Pricing Guide (ไกด์เท่านั้น)</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-700 shrink-0">ต้นทุนจริง AR:</span>
                          <span className="font-mono font-bold text-orange-700 text-xs">{thb(auto.realCostAr)}</span>
                          <span className="text-xs text-amber-600 ml-2 shrink-0">กำไรที่ต้องการ:</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={guideProfitPct}
                            onChange={(e) => setGuideProfitPct(Math.min(99, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            className="w-16 bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-mono text-center"
                          />
                          <span className="text-xs text-amber-700">%</span>
                          <span className="text-xs text-amber-600 ml-1 shrink-0">→ แนะนำ:</span>
                          <span className="font-mono font-bold text-brand-700 text-sm">{guidePrice > 0 ? thb(guidePrice) : "—"}</span>
                          {guidePrice > 0 && (
                            <button
                              type="button"
                              onClick={() => { setRetailInput(String(guidePrice)); setUserModifiedRetail(true); }}
                              className="ml-auto text-[10px] px-2 py-1 rounded-md bg-brand-100 text-brand-700 hover:bg-brand-200 font-semibold shrink-0"
                            >
                              ใช้ราคานี้
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Profit display */}
                  <div className="bg-surface-secondary rounded-lg px-3 py-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-muted">% กำไร Retail (มุม Zudobot vs ต้นทุนจริง AR)</span>
                      <span className={profitColor(validity.retailOk, validity.retailWarn)}>
                        {pct(profit.profitRetailPct)}
                        {!validity.retailOk ? " 🔴" : validity.retailWarn ? " 🟡" : " 🟢"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">% ส่วนลด Partner (มุม Partner)</span>
                      <span className={validity.capOk ? "font-semibold text-text-primary" : "text-red-600 font-semibold"}>
                        {pct(profit.profitPartnerViewPct)}
                        {!validity.capOk ? " 🔴 เกิน 40%" : " ✓"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">% กำไร Partner (มุม Zudobot vs ต้นทุนจริง AR)</span>
                      <span className={profitColor(validity.partnerOk, validity.partnerWarn)}>
                        {pct(profit.profitPartnerZudobotPct)}
                        {!validity.partnerOk ? " 🔴" : validity.partnerWarn ? " 🟡" : " 🟢"}
                      </span>
                    </div>
                  </div>

                  {/* Errors */}
                  {validity.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 space-y-0.5">
                      {validity.errors.map((e, i) => (
                        <p key={i} className="text-red-700 font-medium">🔴 {e}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* cascade warning */}
            {isOnSale && validItems.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                <p className="font-semibold mb-0.5">⚠ การตั้งสถานะ &quot;เปิดขาย&quot;</p>
                <p>เมื่อบันทึก ระบบจะตั้งสถานะ <strong>Active + เปิดขาย</strong> ให้กับ <strong>{validItems.length} Plan/Package</strong> ที่เลือกทั้งหมดโดยอัตโนมัติ</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-default flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary">
              ยกเลิก
            </button>
            <button type="button" disabled={saving || !canSave} onClick={() => void handleSaveClick()}
              className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : mode === "create" ? "สร้างแพคเกจ" : "บันทึก"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Confirmation Dialog ──────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="font-heading font-bold text-text-primary text-lg">💰 ตรวจสอบราคาก่อนบันทึก</h3>
              <p className="text-sm text-text-muted mt-1">
                ราคาที่คุณกำหนดแตกต่างจากที่ระบบแนะนำ กรุณาตรวจสอบก่อนยืนยัน
              </p>
            </div>

            <div className="rounded-xl border border-border-default overflow-hidden text-xs">
              <div className="bg-surface-secondary grid grid-cols-3 px-3 py-2 font-semibold text-text-muted uppercase tracking-wide">
                <span></span><span className="text-center">คุณตั้ง</span><span className="text-center">ระบบแนะนำ</span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 border-t border-border-default">
                <span className="text-text-muted">Final Retail</span>
                <span className="text-center font-mono font-semibold text-brand-600">{thb(finalRetail)}</span>
                <span className="text-center font-mono text-text-muted">{thb(auto.autoRetail)}</span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 border-t border-border-default">
                <span className="text-text-muted">Final Partner</span>
                <span className="text-center font-mono font-semibold">{thb(finalPartner)}</span>
                <span className="text-center font-mono text-text-muted">{thb(auto.autoPartner)}</span>
              </div>
              <div className="bg-surface-secondary px-3 py-2 border-t border-border-default space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">กำไร Retail (Zudobot)</span>
                  <span className={validity.retailOk ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                    {pct(profit.profitRetailPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">ส่วนลด Partner</span>
                  <span className={validity.capOk ? "font-semibold" : "text-red-600 font-semibold"}>
                    {pct(profit.profitPartnerViewPct)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">กำไร Partner (Zudobot)</span>
                  <span className={validity.partnerOk ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                    {pct(profit.profitPartnerZudobotPct)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-text-secondary">ยืนยันบันทึกด้วยราคานี้ใช่ไหมครับ?</p>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary">
                ← กลับไปแก้ไข
              </button>
              <button type="button" onClick={() => void handleConfirmSave()}
                className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">
                ✓ ยืนยัน บันทึกราคานี้
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
