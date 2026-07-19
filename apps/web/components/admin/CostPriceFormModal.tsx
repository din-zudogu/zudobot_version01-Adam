"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fnc_zdb_cal_cost_price,
  DEFAULT_UNIT_COSTS,
  DEFAULT_UNIT_COST_ANCHOR_BJ,
  thb,
  pct,
  type CostPriceInputs,
  type CostPriceCalculationType,
} from "@/lib/pricing/costPriceCalculator";

export type CostPriceScenarioDoc = {
  _id: string;
  label: string;
  packageDescription?: string;
  shareToKnowledgeBase?: boolean;
  isBestPriceHighlight?: boolean;
  isTrialPackage?: boolean;
  isOnSale?: boolean;
  isPartnerAllowed?: boolean;
  inputs: CostPriceInputs;
  calculated: ReturnType<typeof fnc_zdb_cal_cost_price>;
  referenceScenarioId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const EMPTY_INPUTS: CostPriceInputs = {
  plan: "",
  packageName: "",
  baseAddon: "Base",
  aiBaseMonths: 1,
  zudobotBenefitMultiplier: 6,
  partnerSharePct: 0.35,
  discountPct: 0,
  bestPriceZudobot: 0,
  bestPricePartner: 0,
  pricingMode: "unit_calc",
  ...DEFAULT_UNIT_COSTS,
  unitCostAnchorMessageCount: DEFAULT_UNIT_COST_ANCHOR_BJ,
  messageCount: 1000,
  historyTokenCount: 10000,
  tokensPerMessage: 2500,
  tokenDivisor: 1,
  storageMbPerSentence: 8,
  storageCostPerMb: 0.01,
  includeRetentionStorageCost: false,
};

type SavePayload = {
  label: string;
  packageDescription?: string;
  shareToKnowledgeBase: boolean;
  isBestPriceHighlight: boolean;
  isTrialPackage: boolean;
  isOnSale: boolean;
  isPartnerAllowed: boolean;
  inputs: CostPriceInputs;
  sortOrder: number;
  isActive: boolean;
  referenceScenarioId?: string;
};

type Props = {
  mode: "create" | "edit";
  initial?: CostPriceScenarioDoc | null;
  baseScenarios: Array<{ _id: string; label: string; monthlyTotalCost: number }>;
  onSave: (payload: SavePayload) => Promise<void>;
  onClose: () => void;
};

// ── UI Helpers ────────────────────────────────────────────────────────────────

function NInput({
  value,
  onChange,
  step = "1",
  min,
  max,
}: {
  value: number | string;
  onChange: (n: number) => void;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm font-mono"
    />
  );
}

function Row({
  label,
  unit,
  hint,
  span2,
  children,
}: {
  label: string;
  unit?: string;
  hint?: string;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {unit ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">{children}</div>
          <span className="text-xs font-semibold text-text-muted shrink-0 select-none">{unit}</span>
        </div>
      ) : (
        children
      )}
      {hint && <p className="text-[10px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

function SecHead({
  title,
  subtotalLabel,
  subtotal,
}: {
  title: string;
  subtotalLabel?: string;
  subtotal?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-brand-100 pb-1.5 mb-3">
      <h4 className="text-sm font-bold text-text-primary">{title}</h4>
      {subtotal !== undefined && (
        <span className="text-xs font-mono font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
          {subtotalLabel && (
            <span className="font-normal text-text-muted mr-1">{subtotalLabel}</span>
          )}
          {thb(subtotal)}
        </span>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-px bg-border-default" />
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest shrink-0 px-2 py-0.5 border border-border-default rounded-full">
        {label}
      </span>
      <div className="flex-1 h-px bg-border-default" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CostPriceFormModal({ mode, initial, baseScenarios, onSave, onClose }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [packageDescription, setPackageDescription] = useState(initial?.packageDescription ?? "");
  const [shareToKnowledgeBase, setShareToKnowledgeBase] = useState(
    initial?.shareToKnowledgeBase ?? false,
  );
  const [isBestPriceHighlight, setIsBestPriceHighlight] = useState(
    initial?.isBestPriceHighlight ?? false,
  );
  const [isTrialPackage, setIsTrialPackage] = useState(initial?.isTrialPackage ?? false);
  const [isOnSale, setIsOnSale] = useState(initial?.isOnSale ?? true);
  const [isPartnerAllowed, setIsPartnerAllowed] = useState(initial?.isPartnerAllowed ?? true);
  const sortOrder = initial?.sortOrder ?? 0;
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [referenceScenarioId, setReferenceScenarioId] = useState(
    initial?.referenceScenarioId ?? "",
  );
  const [form, setForm] = useState<CostPriceInputs>(() => {
    if (!initial?.inputs) return { ...EMPTY_INPUTS };
    const merged = { ...EMPTY_INPUTS, ...initial.inputs };
    // messageCount: 0 is never a valid quota — treat as unset and use default
    if (!merged.messageCount || merged.messageCount <= 0) merged.messageCount = EMPTY_INPUTS.messageCount;
    return merged;
  });
  const [saving, setSaving] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  const [partnerMarkupPct, setPartnerMarkupPct] = useState(35);
  const [finalRetailInput, setFinalRetailInput] = useState(
    String(initial?.inputs?.bestPriceZudobot ?? 0),
  );
  const [finalPartnerInput, setFinalPartnerInput] = useState(
    String(initial?.inputs?.bestPricePartner ?? 0),
  );
  const [userModifiedFinalRetail, setUserModifiedFinalRetail] = useState(
    (initial?.inputs?.bestPriceZudobot ?? 0) > 0,
  );
  const [userModifiedFinalPartner, setUserModifiedFinalPartner] = useState(
    (initial?.inputs?.bestPricePartner ?? 0) > 0,
  );

  const calculated = useMemo(() => {
    const type = form.calculationType;
    // Each type prices only its own cost bucket — shared inputs (messageCount,
    // storageMbPerSentence) still drive calculations but don't bleed AR.
    const override: Partial<CostPriceInputs> =
      type === "ai_base"
        ? { storageMbPerMonth: 0, includeRetentionStorageCost: false }
        : type === "storage"
        ? {
            tokensPerMessage: 0, historyTokenCount: 0,
            unitCostDatabase: 0, unitCostAws: 0, unitCostVatIntl: 0,
            unitCostFxRisk: 0, unitCostPaymentGateway: 0,
            includeRetentionStorageCost: false,
          }
        : type === "expired"
        ? {
            tokensPerMessage: 0, historyTokenCount: 0,
            storageMbPerMonth: 0,
            unitCostDatabase: 0, unitCostAws: 0, unitCostVatIntl: 0,
            unitCostFxRisk: 0, unitCostPaymentGateway: 0,
          }
        : {};
    return fnc_zdb_cal_cost_price({ ...form, ...override });
  }, [form]);

  const autoFinalRetail = useMemo(() => {
    const ar = calculated.totalCostAr;
    if (ar <= 0) return 0;
    const Z = form.zudobotBenefitMultiplier / (form.zudobotBenefitMultiplier + 1);
    const costWithWht = ar * 1.03;
    return Z >= 1 ? 0 : Math.ceil(costWithWht / (1 - Z) / 100) * 100;
  }, [calculated.totalCostAr, form.zudobotBenefitMultiplier]);

  const autoFinalPartner = useMemo(() => {
    const ar = calculated.totalCostAr;
    if (ar <= 0) return 0;
    const costWithWht = ar * 1.03;
    return Math.ceil((costWithWht * (1 + partnerMarkupPct / 100)) / 100) * 100;
  }, [calculated.totalCostAr, partnerMarkupPct]);

  useEffect(() => {
    if (!userModifiedFinalRetail && autoFinalRetail > 0) {
      setFinalRetailInput(String(autoFinalRetail));
    }
  }, [autoFinalRetail, userModifiedFinalRetail]);

  useEffect(() => {
    if (!userModifiedFinalPartner && autoFinalPartner > 0) {
      setFinalPartnerInput(String(autoFinalPartner));
    }
  }, [autoFinalPartner, userModifiedFinalPartner]);

  const finalRetail = Number.isFinite(parseFloat(finalRetailInput))
    ? parseFloat(finalRetailInput)
    : autoFinalRetail;
  const finalPartner = Number.isFinite(parseFloat(finalPartnerInput))
    ? parseFloat(finalPartnerInput)
    : autoFinalPartner;
  const isFinalPriceModified = userModifiedFinalRetail || userModifiedFinalPartner;

  function resetFinalToAuto() {
    setFinalRetailInput(String(autoFinalRetail));
    setFinalPartnerInput(String(autoFinalPartner));
    setUserModifiedFinalRetail(false);
    setUserModifiedFinalPartner(false);
  }

  function handleSetTrialPackage(checked: boolean) {
    setIsTrialPackage(checked);
    if (checked) {
      setFinalRetailInput("0");
      setFinalPartnerInput("0");
      setUserModifiedFinalRetail(false);
      setUserModifiedFinalPartner(false);
    }
  }

  function set<K extends keyof CostPriceInputs>(key: K, value: CostPriceInputs[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleSetCalculationType(type: CostPriceCalculationType | "") {
    if (!type) {
      setForm((p) => ({ ...p, calculationType: undefined }));
      return;
    }
    setForm((p) => ({
      ...p,
      calculationType: type,
      baseAddon: type === "ai_base" ? "Base" : "Add-on",
      // Auto-enable retention when switching to memory-expired mode
      ...(type === "expired" ? { includeRetentionStorageCost: true } : {}),
    }));
  }

  function applyReferenceBase(id: string) {
    setReferenceScenarioId(id);
    const base = baseScenarios.find((b) => b._id === id);
    if (base) {
      setForm((p) => ({
        ...p,
        pricingMode: "reference_multiple",
        referenceUnitCostAq: base.monthlyTotalCost,
      }));
    }
  }

  async function doSave() {
    setSaving(true);
    const finalForm: CostPriceInputs = {
      ...form,
      bestPriceZudobot: isTrialPackage ? 0 : finalRetail,
      bestPricePartner: isTrialPackage ? 0 : finalPartner,
    };
    await onSave({
      label: label.trim(),
      packageDescription: packageDescription.trim() || undefined,
      shareToKnowledgeBase,
      isBestPriceHighlight,
      isTrialPackage,
      isOnSale,
      isPartnerAllowed,
      inputs: finalForm,
      sortOrder,
      isActive,
      referenceScenarioId: referenceScenarioId || undefined,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
      <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-bold text-text-primary">
              {mode === "create" ? "เพิ่มรายการคำนวณราคา" : "แก้ไขรายการคำนวณราคา"}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              สูตรอ้างอิงไฟล์ Zudobot_Calculate_Cost&amp;Price-20260529.xlsx · FTS v1.2.0
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                ประเภทการคำนวณ
              </label>
              <select
                value={form.calculationType ?? ""}
                onChange={(e) =>
                  handleSetCalculationType(e.target.value as CostPriceCalculationType | "")
                }
                className={`border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                  !form.calculationType
                    ? "border-red-300 bg-red-50 text-red-600"
                    : form.calculationType === "ai_base"
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : form.calculationType === "storage"
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-violet-300 bg-violet-50 text-violet-700"
                }`}
              >
                <option value="">— เลือกประเภท —</option>
                <option value="ai_base">AI Base (Token)</option>
                <option value="storage">Storage (MB)</option>
                <option value="expired">Memory Expired</option>
              </select>
            </div>
            <button type="button" onClick={onClose} className="text-xl text-text-muted hover:text-text-primary">
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 grid lg:grid-cols-2 gap-6">

          {/* ══════════════ LEFT PANEL ══════════════ */}
          <div className="space-y-5">

            {/* ชื่อรายการ */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                ชื่อรายการ (แสดงในตาราง)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* สถานะ */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-brand-600"
                />
                <span className="text-sm text-text-secondary">ใช้งาน (Active)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOnSale}
                  onChange={(e) => setIsOnSale(e.target.checked)}
                  className="accent-emerald-600"
                />
                <span className="text-sm text-text-secondary">เปิดขาย (On Sale)</span>
              </label>
            </div>

            {/* การตั้งค่าพิเศษ */}
            <div className="border border-border-default rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-text-primary">การตั้งค่าพิเศษ</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBestPriceHighlight}
                    onChange={(e) => setIsBestPriceHighlight(e.target.checked)}
                    className="accent-brand-600"
                  />
                  ไฮไลท์ราคาดีที่สุด (Best Price)
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTrialPackage}
                    onChange={(e) => handleSetTrialPackage(e.target.checked)}
                    className="accent-amber-500"
                  />
                  แพ็กเกจทดลองใช้ฟรี (Trial)
                </label>
              </div>
              {isTrialPackage && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
                  ⚠ Trial package — ราคาขาย Retail และ Partner ถูกกำหนดเป็น ฿0.00 เสมอ
                </p>
              )}
            </div>

            {/* สิทธิ์ Partner */}
            <div className="border border-border-default rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-text-primary">สิทธิ์ Partner</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPartnerAllowed}
                  onChange={(e) => setIsPartnerAllowed(e.target.checked)}
                  className="accent-brand-600 mt-0.5"
                />
                <div>
                  <p className="text-sm text-text-secondary">อนุญาตให้ Partner ขายได้</p>
                  <p className="text-xs text-text-muted">
                    {isPartnerAllowed
                      ? "Partner สามารถนำเสนอแพลนนี้ให้ลูกค้าได้"
                      : "เฉพาะ Zudobot เท่านั้นที่ขายได้"}
                  </p>
                </div>
              </label>
            </div>

            {/* ══ C. ข้อมูลแพ็กเกจ ══ */}
            <Divider label="ข้อมูลแพ็กเกจ" />

            <div className="grid grid-cols-2 gap-3">
              <Row label="Plan">
                <input
                  type="text"
                  value={form.plan}
                  onChange={(e) => set("plan", e.target.value)}
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </Row>
              <Row label="Package">
                <input
                  type="text"
                  value={form.packageName}
                  onChange={(e) => set("packageName", e.target.value)}
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </Row>
              <Row label="ประเภทแพ็กเกจ" span2>
                <select
                  value={form.baseAddon}
                  onChange={(e) =>
                    set("baseAddon", e.target.value as CostPriceInputs["baseAddon"])
                  }
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
                >
                  <option value="Base">Base — แพ็กเกจหลัก</option>
                  <option value="Add-on">Add-on — บริการเสริม</option>
                </select>
              </Row>
            </div>

            <div className="border border-border-default rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-text-primary">แชร์ไปยัง Knowledge Base</p>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareToKnowledgeBase}
                  onChange={(e) => setShareToKnowledgeBase(e.target.checked)}
                  className="accent-emerald-600"
                />
                แชร์ข้อมูลเข้า Zudobot Knowledge Base
              </label>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  คำอธิบายสินค้า (แสดงในหน้าขาย)
                </label>
                <textarea
                  rows={3}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  maxLength={1000}
                  placeholder="คำอธิบายรายละเอียดสินค้า — แสดงในหน้าขายและ Knowledge Base เมื่อเปิดแชร์ข้อมูล"
                  className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm resize-none"
                />
                <p className="text-[10px] text-text-muted mt-0.5">
                  {packageDescription.length}/1000 ตัวอักษร
                </p>
              </div>
            </div>

            {/* วิธีคำนวณ + อ้างอิง + ระยะเวลา */}
            <div className="space-y-3">
              <SecHead title="วิธีคำนวณและระยะเวลา" />
              <div className="grid grid-cols-2 gap-3">
                <Row label="วิธีคำนวณต้นทุน" span2>
                  <select
                    value={form.pricingMode}
                    onChange={(e) =>
                      set("pricingMode", e.target.value as CostPriceInputs["pricingMode"])
                    }
                    className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="unit_calc">คำนวณจากหน่วยต้นทุน (ROUNDUP SUM)</option>
                    <option value="reference_multiple">อ้างอิงรายการฐาน × เดือน</option>
                  </select>
                </Row>
                {baseScenarios.length > 0 && (
                  <Row label="อ้างอิงต้นทุนจากรายการอื่น" span2>
                    <select
                      value={referenceScenarioId}
                      onChange={(e) => applyReferenceBase(e.target.value)}
                      className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— ไม่อ้างอิง —</option>
                      {baseScenarios.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.label} ({thb(b.monthlyTotalCost)})
                        </option>
                      ))}
                    </select>
                  </Row>
                )}
                <Row label="ระยะเวลาแพ็กเกจ" unit="เดือน">
                  <NInput value={form.aiBaseMonths} onChange={(n) => set("aiBaseMonths", n)} />
                </Row>
                <Row label="ระยะเวลาทดลองใช้" unit="วัน" hint="ปกติ 14 วัน">
                  <NInput
                    value={form.trialDurationDays ?? 0}
                    onChange={(n) => set("trialDurationDays", n)}
                  />
                </Row>
              </div>
            </div>

            {/* % กำไร */}
            <div className="border border-brand-200 bg-brand-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-brand-800">
                กำหนด % กำไรที่ต้องการ (คำนวณราคาอัตโนมัติ)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    % กำไร Zudobot (จากราคาขาย)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      step="0.1"
                      value={Number(
                        (
                          (form.zudobotBenefitMultiplier /
                            (form.zudobotBenefitMultiplier + 1)) *
                          100
                        ).toFixed(1),
                      )}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value);
                        if (p > 0 && p < 100) {
                          const g = p / 100 / (1 - p / 100);
                          set("zudobotBenefitMultiplier", Math.round(g * 1000) / 1000);
                        }
                      }}
                      className="flex-1 bg-white border border-brand-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                    />
                    <span className="text-sm font-semibold text-brand-700">%</span>
                  </div>
                  <p className="text-[10px] text-brand-600 mt-0.5">
                    G = {form.zudobotBenefitMultiplier.toFixed(3)} · N = AR ×{" "}
                    {(form.zudobotBenefitMultiplier + 1).toFixed(3)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    % กำไร Partner (บนต้นทุน+WHT)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="200"
                      step="0.1"
                      value={partnerMarkupPct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v > 0) setPartnerMarkupPct(v);
                      }}
                      className="flex-1 bg-white border border-brand-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                    />
                    <span className="text-sm font-semibold text-brand-700">%</span>
                  </div>
                  <p className="text-[10px] text-brand-600 mt-0.5">
                    Final Partner = (AR×1.03) × {(1 + partnerMarkupPct / 100).toFixed(3)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    ส่วนแบ่ง Partner (K share)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={form.partnerSharePct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) set("partnerSharePct", v);
                      }}
                      className="flex-1 bg-white border border-brand-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                    />
                    <span className="text-xs text-brand-600 shrink-0">
                      {(form.partnerSharePct * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-600 mt-0.5">
                    ส่วนลด Partner = {(form.partnerSharePct * 100).toFixed(1)}% ของ N
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    ส่วนลดราคา
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={form.discountPct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) set("discountPct", v);
                      }}
                      className="flex-1 bg-white border border-brand-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                    />
                    <span className="text-xs text-brand-600 shrink-0">
                      {(form.discountPct * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ A. ต้นทุน ══ */}
            <Divider label="ต้นทุน" />

            {/* AI Base / Token + Infrastructure */}
            <div className="space-y-3">
              {form.calculationType === "ai_base" && (
                <p className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-1.5">
                  AI Base — AR รวม: AI Token + Infrastructure · Storage และ Retention ไม่นับ
                </p>
              )}
              {form.calculationType === "storage" && (
                <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5">
                  Storage — AR รวม: Storage เท่านั้น · AI, Infra และ Retention ไม่นับ
                </p>
              )}
              {form.calculationType === "expired" && (
                <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
                  Memory Expired — AR รวม: Retention เท่านั้น · AI, Storage และ Infra ไม่นับ
                </p>
              )}
              <SecHead
                title="AI Base / Token"
                subtotalLabel="ต้นทุน:"
                subtotal={
                  calculated.costAiCore + calculated.costTokenUsage +
                  calculated.costMongoDb + calculated.costAws +
                  calculated.costVatIntl + calculated.costFxRisk + calculated.costPaymentGateway
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <Row label="จำนวนข้อความ/เดือน" unit="ข้อความ" span2>
                  <NInput value={form.messageCount} onChange={(n) => set("messageCount", n)} min="1" />
                </Row>
                <Row label="Token ต่อ 1 ข้อความ" unit="tokens">
                  <NInput value={form.tokensPerMessage} onChange={(n) => set("tokensPerMessage", n)} />
                </Row>
                <Row label="ประวัติสนทนา Token/เดือน" unit="tokens">
                  <NInput value={form.historyTokenCount} onChange={(n) => set("historyTokenCount", n)} />
                </Row>
              </div>
              <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-text-muted">Input tokens</span>
                <span className="font-mono text-right">{thb(calculated.costAiCore)}</span>
                <span className="text-text-muted">Output tokens</span>
                <span className="font-mono text-right">{thb(calculated.costTokenUsage)}</span>
              </div>

              {/* Infrastructure — sub-section of AI Base */}
              <div className="border border-amber-200 rounded-xl p-3 space-y-3 bg-amber-50/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-800">Infrastructure</p>
                  <span className="text-xs font-mono text-amber-700">
                    {thb(
                      calculated.costMongoDb + calculated.costAws +
                      calculated.costVatIntl + calculated.costFxRisk + calculated.costPaymentGateway
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Row label="ฐานข้อมูล (MongoDB) ต่อข้อความ" unit="฿">
                    <NInput
                      value={form.unitCostDatabase}
                      onChange={(n) => set("unitCostDatabase", n)}
                      step="0.0001"
                    />
                  </Row>
                  <Row label="เซิร์ฟเวอร์ (AWS) ต่อข้อความ" unit="฿">
                    <NInput
                      value={form.unitCostAws}
                      onChange={(n) => set("unitCostAws", n)}
                      step="0.0001"
                    />
                  </Row>
                  <Row label="ภาษีต่างประเทศ (VAT) ต่อข้อความ" unit="฿">
                    <NInput
                      value={form.unitCostVatIntl}
                      onChange={(n) => set("unitCostVatIntl", n)}
                      step="0.0001"
                    />
                  </Row>
                  <Row label="ความเสี่ยงค่าเงิน (FX Risk) ต่อข้อความ" unit="฿">
                    <NInput
                      value={form.unitCostFxRisk}
                      onChange={(n) => set("unitCostFxRisk", n)}
                      step="0.0001"
                    />
                  </Row>
                  <Row label="ค่าธรรมเนียมชำระเงิน (Payment GW)" unit="฿" span2>
                    <NInput
                      value={form.unitCostPaymentGateway}
                      onChange={(n) => set("unitCostPaymentGateway", n)}
                      step="0.0001"
                    />
                  </Row>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <span className="text-text-muted">Database</span>
                  <span className="font-mono text-right">{thb(calculated.costMongoDb)}</span>
                  <span className="text-text-muted">AWS</span>
                  <span className="font-mono text-right">{thb(calculated.costAws)}</span>
                  <span className="text-text-muted">VAT Intl</span>
                  <span className="font-mono text-right">{thb(calculated.costVatIntl)}</span>
                  <span className="text-text-muted">FX Risk</span>
                  <span className="font-mono text-right">{thb(calculated.costFxRisk)}</span>
                  <span className="text-text-muted">Payment GW</span>
                  <span className="font-mono text-right">{thb(calculated.costPaymentGateway)}</span>
                </div>
              </div>
            </div>

            {/* Storage / MB */}
            <div className="space-y-3">
              <SecHead
                title="Storage / MB"
                subtotalLabel="ต้นทุน:"
                subtotal={calculated.costS3 + calculated.costStorageUsage}
              />
              <div className="grid grid-cols-2 gap-3">
                <Row label="พื้นที่จัดเก็บต่อข้อความ" unit="MB">
                  <NInput
                    value={form.storageMbPerSentence}
                    onChange={(n) => set("storageMbPerSentence", n)}
                    step="0.1"
                  />
                </Row>
                <Row
                  label="พื้นที่จัดเก็บที่ต้องการเพิ่ม/เดือน"
                  unit="MB"
                  hint={`auto = ${((form.storageMbPerSentence ?? 8) * (form.messageCount ?? 1000)).toLocaleString()} MB`}
                  span2
                >
                  <NInput
                    value={form.storageMbPerMonth ?? (form.storageMbPerSentence ?? 8) * (form.messageCount ?? 1000)}
                    onChange={(n) => set("storageMbPerMonth", n)}
                    step="1"
                    min="0"
                  />
                </Row>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-text-muted">S3</span>
                <span className="font-mono text-right">{thb(calculated.costS3)}</span>
                <span className="text-text-muted">Storage</span>
                <span className="font-mono text-right">{thb(calculated.costStorageUsage)}</span>
                <span className="text-text-muted">พื้นที่รวม</span>
                <span className="font-mono text-right">{(form.storageMbPerMonth ?? (form.storageMbPerSentence ?? 8) * (form.messageCount ?? 1000)).toLocaleString()} MB</span>
              </div>
            </div>

            {/* Memory Expired */}
            <div className="space-y-3">
              <SecHead
                title="Memory Expired"
                subtotalLabel="ต้นทุน:"
                subtotal={calculated.costRetentionStorage}
              />
              {/* read-only: conversations/day derived from AI Base messageCount */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-violet-700 font-medium">จำนวนประโยคสนทนาต่อวัน</span>
                  <span className="font-mono font-semibold text-violet-900">
                    {Math.ceil((form.messageCount ?? 0) / 30).toLocaleString()} ประโยค/วัน
                  </span>
                </div>
                <div className="flex items-center justify-between text-violet-500">
                  <span>MB ต่อประโยค (จาก Storage)</span>
                  <span className="font-mono">{form.storageMbPerSentence ?? 8} MB</span>
                </div>
                <p className="text-violet-400 pt-0.5">
                  = ceil({(form.messageCount ?? 0).toLocaleString()} / 30) ปัดขึ้นเป็นจำนวนเต็ม
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Row label="จำนวนวันเก็บบทสนทนา" unit="วัน" span2>
                  <NInput
                    value={form.storageExpireDays ?? 0}
                    onChange={(n) => set("storageExpireDays", Math.min(n, 3650))}
                    min="1"
                    max="3650"
                  />
                </Row>
                <Row label="ราคาจัดเก็บต่อ MB" unit="฿/MB" span2>
                  <NInput
                    value={form.costPerMb}
                    onChange={(n) => set("costPerMb", n)}
                    step="0.0001"
                  />
                </Row>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.includeRetentionStorageCost}
                    onChange={(e) => set("includeRetentionStorageCost", e.target.checked)}
                    className="accent-brand-600"
                  />
                  <label className="text-xs text-text-secondary cursor-pointer">
                    รวมต้นทุนการเก็บข้อมูล (Retention) ในต้นทุนรวม
                  </label>
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-text-muted">Retention</span>
                <span className="font-mono text-right">{thb(calculated.costRetentionStorage)}</span>
              </div>
            </div>

            {/* ══ B. ราคาขาย ══ */}
            <Divider label="ราคาขาย" />

            {/* Final Price */}
            {calculated.totalCostAr > 0 && !isTrialPackage && (
              <div className="border-2 border-brand-200 rounded-xl overflow-hidden">
                <div className="bg-brand-50 px-4 py-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-800">ตั้งราคาขายสุดท้าย</p>
                  {isFinalPriceModified && (
                    <button
                      type="button"
                      onClick={resetFinalToAuto}
                      className="text-xs text-brand-600 hover:underline font-medium"
                    >
                      ↺ Reset เป็น auto
                    </button>
                  )}
                </div>
                <div className="px-4 py-3 space-y-3 text-xs bg-white">
                  <p className="text-text-muted">
                    ต้นทุน + WHT 3%:{" "}
                    <strong>{thb(calculated.totalCostAr * 1.03)}</strong>
                    {" · "}Retail auto:{" "}
                    <strong className="text-brand-600">{thb(autoFinalRetail)}</strong>
                    {" · "}Partner auto: <strong>{thb(autoFinalPartner)}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">
                        ราคาขาย Retail (฿)
                      </label>
                      <input
                        type="number"
                        value={finalRetailInput}
                        onChange={(e) => {
                          setFinalRetailInput(e.target.value);
                          setUserModifiedFinalRetail(true);
                        }}
                        className={`w-full bg-surface-secondary border rounded-lg px-3 py-2 text-sm font-mono ${
                          userModifiedFinalRetail
                            ? "border-brand-400 ring-1 ring-brand-200"
                            : "border-border-default"
                        }`}
                      />
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {userModifiedFinalRetail ? "ปรับแล้ว" : `auto: ${thb(autoFinalRetail)}`}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">
                        ราคาขาย Partner (฿)
                      </label>
                      <input
                        type="number"
                        value={finalPartnerInput}
                        onChange={(e) => {
                          setFinalPartnerInput(e.target.value);
                          setUserModifiedFinalPartner(true);
                        }}
                        className={`w-full bg-surface-secondary border rounded-lg px-3 py-2 text-sm font-mono ${
                          userModifiedFinalPartner
                            ? "border-brand-400 ring-1 ring-brand-200"
                            : "border-border-default"
                        }`}
                      />
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {userModifiedFinalPartner
                          ? "ปรับแล้ว"
                          : `auto: ${thb(autoFinalPartner)}`}
                      </p>
                    </div>
                  </div>
                  {finalRetail > 0 && (
                    <div className="bg-surface-secondary rounded-lg px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-text-muted">กำไร Zudobot จาก Retail</span>
                      <span
                        className={`font-mono font-semibold ${
                          finalRetail - calculated.totalCostAr * 1.03 >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {thb(finalRetail - calculated.totalCostAr * 1.03)}{" "}
                        <span className="text-[10px]">
                          (
                          {calculated.totalCostAr > 0
                            ? (
                                ((finalRetail - calculated.totalCostAr * 1.03) / finalRetail) *
                                100
                              ).toFixed(1)
                            : 0}
                          %)
                        </span>
                      </span>
                      <span className="text-text-muted">กำไร Partner</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {thb(finalRetail - finalPartner)}{" "}
                        <span className="text-[10px]">
                          (
                          {finalRetail > 0
                            ? (((finalRetail - finalPartner) / finalRetail) * 100).toFixed(1)
                            : 0}
                          % ของ Retail)
                        </span>
                      </span>
                      <span className="text-text-muted">กำไร Zudobot จาก Partner</span>
                      <span
                        className={`font-mono font-semibold ${
                          finalPartner - calculated.totalCostAr * 1.03 >= 0
                            ? "text-brand-600"
                            : "text-red-600"
                        }`}
                      >
                        {thb(finalPartner - calculated.totalCostAr * 1.03)}{" "}
                        <span className="text-[10px]">
                          (
                          {finalPartner > 0
                            ? (
                                ((finalPartner - calculated.totalCostAr * 1.03) / finalPartner) *
                                100
                              ).toFixed(1)
                            : 0}
                          % ของ Partner)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ══════════════ RIGHT PANEL ══════════════ */}
          <div className="bg-surface-secondary rounded-xl p-4 text-xs space-y-4 lg:sticky lg:top-0 h-fit">
            <p className="font-semibold text-text-primary">ผลคำนวณแบบ Real-time (ตามสูตร Excel)</p>

            {/* ต้นทุนรวม */}
            <div>
              <p className="font-medium text-text-secondary mb-1">ต้นทุนรวม (AR)</p>
              <p className="text-lg font-mono font-bold text-brand-600">
                {thb(calculated.totalCostAr)}
              </p>
              <p className="text-text-muted">ดิบ AS = {thb(calculated.totalCostRaw)}</p>
            </div>

            {/* Cost breakdown by section */}
            <div className="space-y-2">
              <div className="rounded-lg bg-white border border-brand-100 px-2 py-1.5">
                <p className="text-[10px] font-bold text-brand-700 uppercase mb-1">AI Base / Token</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-text-muted">Input tokens</span>
                  <span className="font-mono text-right">{thb(calculated.costAiCore)}</span>
                  <span className="text-text-muted">Output tokens</span>
                  <span className="font-mono text-right">{thb(calculated.costTokenUsage)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-sky-100 px-2 py-1.5">
                <p className="text-[10px] font-bold text-sky-700 uppercase mb-1">Storage</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-text-muted">S3</span>
                  <span className="font-mono text-right">{thb(calculated.costS3)}</span>
                  <span className="text-text-muted">Storage</span>
                  <span className="font-mono text-right">{thb(calculated.costStorageUsage)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-violet-100 px-2 py-1.5">
                <p className="text-[10px] font-bold text-violet-700 uppercase mb-1">Expired / Retention</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-text-muted">Retention</span>
                  <span className="font-mono text-right">{thb(calculated.costRetentionStorage)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-amber-100 px-2 py-1.5">
                <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Infrastructure</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-text-muted">Database</span>
                  <span className="font-mono text-right">{thb(calculated.costMongoDb)}</span>
                  <span className="text-text-muted">AWS</span>
                  <span className="font-mono text-right">{thb(calculated.costAws)}</span>
                </div>
              </div>
            </div>

            {/* Pricing chain */}
            <div className="border-t border-border-default pt-3 grid grid-cols-2 gap-x-3 gap-y-1">
              <span>กำไร Zudobot (I)</span>
              <span className="font-mono">{thb(calculated.zudobotBenefitThb)}</span>
              <span>กำไร Partner (J)</span>
              <span className="font-mono">{thb(calculated.partnerBenefitThb)}</span>
              <span>ราคา/เดือน Zudobot (N)</span>
              <span className="font-mono">{thb(calculated.priceMonthZudobot)}</span>
              <span>ราคา/เดือน Partner (O)</span>
              <span className="font-mono">{thb(calculated.priceMonthPartner)}</span>
              <span>ราคา incl. WHT (P)</span>
              <span className="font-mono">{thb(calculated.priceZudobotInclWhtBeforeVat)}</span>
              <span>หลังส่วนลด (U)</span>
              <span className="font-mono">{thb(calculated.afterDiscountZudobot)}</span>
              <span>VAT 7% (W)</span>
              <span className="font-mono">{thb(calculated.vat7Zudobot)}</span>
              <span>WHT 3% on N (Y)</span>
              <span className="font-mono">{thb(calculated.wht3Zudobot)}</span>
              <span className="font-semibold">ราคาหลัง VAT (AA)</span>
              <span className="font-mono font-semibold">{thb(calculated.priceAfterVatZudobot)}</span>
              <span>Best Price Zudobot (AC)</span>
              <span className="font-mono">{thb(form.bestPriceZudobot)}</span>
              <span>กำไร Partner (AG)</span>
              <span className="font-mono text-emerald-600">
                {thb(calculated.estimatePartnerBenefitThb)}{" "}
                ({pct(calculated.estimatePartnerBenefitPct)})
              </span>
            </div>

            {/* Profit analysis */}
            {calculated.totalCostAr > 0 && (() => {
              const ar = calculated.totalCostAr;
              const N = calculated.priceMonthZudobot;
              const O = calculated.priceMonthPartner;
              const wht = calculated.wht3Zudobot;
              const costPlusWht = ar + wht;
              const retailGross = N - ar;
              const retailGrossPct = N > 0 ? (retailGross / N) * 100 : 0;
              const retailNet = N - ar - wht;
              const retailNetPct = N > 0 ? (retailNet / N) * 100 : 0;
              const partnerMargin = N - O;
              const partnerMarginPct = N > 0 ? (partnerMargin / N) * 100 : 0;
              const zFromPartner = O - ar;
              const zFromPartnerPct = O > 0 ? (zFromPartner / O) * 100 : 0;
              return (
                <div className="border-t border-border-default pt-3 space-y-2">
                  <p className="font-semibold text-text-primary">วิเคราะห์กำไร (Real-time)</p>
                  <div className="bg-white rounded-lg px-2 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 border border-border-default">
                    <span className="text-text-muted">AR (ต้นทุนจริง)</span>
                    <span className="font-mono font-semibold">{thb(ar)}</span>
                    <span className="text-text-muted">WHT 3% บน N</span>
                    <span className="font-mono">{thb(wht)}</span>
                    <span className="text-text-muted font-medium">ต้นทุน + WHT</span>
                    <span className="font-mono font-semibold text-orange-600">{thb(costPlusWht)}</span>
                  </div>
                  <div className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span className="col-span-2 text-[10px] font-semibold text-brand-700 uppercase">
                      Retail (Zudobot)
                    </span>
                    <span className="text-text-muted">กำไรก่อน WHT (N−AR)</span>
                    <span className="font-mono text-brand-600 font-semibold">
                      {thb(retailGross)}{" "}
                      <span className="text-[10px]">({retailGrossPct.toFixed(1)}%)</span>
                    </span>
                    <span className="text-text-muted">กำไรสุทธิ (หลัง WHT)</span>
                    <span
                      className={`font-mono font-semibold ${retailNet >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {thb(retailNet)}{" "}
                      <span className="text-[10px]">({retailNetPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span className="col-span-2 text-[10px] font-semibold text-emerald-700 uppercase">
                      Partner
                    </span>
                    <span className="text-text-muted">กำไร Partner (N−O)</span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      {thb(partnerMargin)}{" "}
                      <span className="text-[10px]">({partnerMarginPct.toFixed(1)}% ของ N)</span>
                    </span>
                    <span className="text-text-muted">กำไร Zudobot จาก Partner</span>
                    <span
                      className={`font-mono font-semibold ${zFromPartner >= 0 ? "text-brand-600" : "text-red-600"}`}
                    >
                      {thb(zFromPartner)}{" "}
                      <span className="text-[10px]">({zFromPartnerPct.toFixed(1)}% ของ O)</span>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* KB sync preview */}
            {shareToKnowledgeBase && (
              <div className="border-t border-border-default pt-3 space-y-1">
                <p className="font-medium text-emerald-700">ข้อมูลที่จะ sync ไป KB</p>
                <p className="text-text-muted">
                  {form.plan} · {form.packageName}
                </p>
                {form.bestPriceZudobot > 0 && (
                  <p className="text-text-muted">
                    Best Price: {thb(form.bestPriceZudobot)} / {thb(form.bestPricePartner)}
                  </p>
                )}
                <p className="text-text-muted">
                  {form.messageCount.toLocaleString()} ข้อความ/เดือน
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving || !label.trim()}
            onClick={async () => {
              if (isFinalPriceModified && !isTrialPackage && !showFinalConfirm) {
                setShowFinalConfirm(true);
                return;
              }
              setShowFinalConfirm(false);
              await doSave();
            }}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* Final Price Confirmation Dialog */}
      {showFinalConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-sm p-6 space-y-4">
            <h3 className="font-heading font-bold text-text-primary text-lg">ยืนยันราคาขาย</h3>
            <p className="text-sm text-text-muted">ราคาที่กำหนดแตกต่างจากที่ระบบแนะนำ</p>
            <div className="rounded-xl border border-border-default overflow-hidden text-xs">
              <div className="bg-surface-secondary grid grid-cols-3 px-3 py-2 font-semibold text-text-muted uppercase">
                <span></span>
                <span className="text-center">คุณตั้ง</span>
                <span className="text-center">auto</span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 border-t border-border-default">
                <span className="text-text-muted">Final Retail</span>
                <span className="text-center font-mono font-semibold text-brand-600">
                  {thb(finalRetail)}
                </span>
                <span className="text-center font-mono text-text-muted">
                  {thb(autoFinalRetail)}
                </span>
              </div>
              <div className="px-3 py-2 grid grid-cols-3 border-t border-border-default">
                <span className="text-text-muted">Final Partner</span>
                <span className="text-center font-mono font-semibold">{thb(finalPartner)}</span>
                <span className="text-center font-mono text-text-muted">
                  {thb(autoFinalPartner)}
                </span>
              </div>
            </div>
            <p className="text-sm text-text-secondary">ยืนยันบันทึกด้วยราคานี้ใช่ไหม?</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFinalConfirm(false)}
                className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary"
              >
                ← กลับแก้ไข
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowFinalConfirm(false);
                  await doSave();
                }}
                className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
              >
                ✓ ยืนยัน บันทึกราคานี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
