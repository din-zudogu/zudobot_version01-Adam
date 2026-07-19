/**
 * readyPackageSpec.ts
 *
 * Utility functions (ftc_ prefix = "function to create") for ReadyPackage:
 *   - ftc_build_ready_package_spec   — spec card per item (used in modal)
 *   - ftc_calc_auto_prices           — auto-pricing with business rules
 *   - ftc_calc_profit                — profit % calculations (all views)
 *   - ftc_validate_prices            — validation state (OK/warn/error)
 *   - ftc_build_grouped_summary      — grouped description for table column
 */
import type { CostPriceScenarioDoc } from "@/components/admin/CostPriceFormModal";

/** Minimal price fields needed by calc functions (compatible with both DB and client types) */
type PriceFields = {
  bestPriceZudobot: number;
  wht3Zudobot: number;
  bestPricePartner: number;
  wht3Partner: number;
  /** ต้นทุนจริง (AR column) — optional เพราะ old records อาจไม่มี */
  totalCostAr?: number;
};

/** Spec snapshot fields needed by grouped summary */
type SpecFields = PriceFields & {
  plan: string;
  packageName?: string;
  messageCount?: number;
  tokensPerMessage?: number;
  historyTokenCount?: number;
  storageMbPerSentence?: number;
  storageExpireDays?: number;
  trialDurationDays?: number;
};

// ============================================================
// Types
// ============================================================

export type ReadyPackageSpecResult = {
  colorClass: string;
  typeLabel: string;
  specLines: Array<{ label: string; value: string; warning?: boolean }>;
  standardFeatures: string[];
};

export type AutoPrices = {
  /** Σ(bestPriceZudobot + wht3Zudobot) — ราคาขายรวม WHT ของแต่ละ scenario (ใช้เป็น floor auto pricing) */
  costRetail: number;
  /** Σ(bestPricePartner + wht3Partner) */
  costPartner: number;
  /** Σ bestPriceZudobot — ราคาขายแยก (ใช้ marketing comparison) */
  sumRetail: number;
  sumPartner: number;
  /** Σ totalCostAr — ต้นทุนจริง production (AR) ใช้คำนวณ % กำไรจริงของ Zudobot */
  realCostAr: number;
  autoRetail: number;   // suggested Final Retail (ROUNDUP to 100)
  autoPartner: number;  // suggested Final Partner (CLAMP)
};

export type ProfitResult = {
  /** % กำไร Retail จากมุม Zudobot = (finalRetail - ต้นทุนจริง AR) / finalRetail */
  profitRetailPct: number;
  /** % ส่วนลด Partner จากมุม Partner = (finalRetail - finalPartner) / finalRetail (≤ 40%) */
  profitPartnerViewPct: number;
  /** % กำไร Partner จากมุม Zudobot = (finalPartner - ต้นทุนจริง AR) / finalPartner */
  profitPartnerZudobotPct: number;
  savingVsSeparate: number;
};

export type ValidationState = {
  retailOk: boolean;    // finalRetail > costRetail
  partnerOk: boolean;   // finalPartner > costPartner
  capOk: boolean;       // partnerViewPct ≤ 40%
  canSave: boolean;
  retailWarn: boolean;  // profit < 5% (thin margin)
  partnerWarn: boolean;
  errors: string[];
};

export type GroupedSummaryLine = {
  icon: string;
  label: string;
  details: string;
};

// ============================================================
// Constants
// ============================================================

const STANDARD_FEATURES: string[] = [
  "แจ้งเตือนแอดมินผ่านไลน์",
  "สนทนาได้ 24 ชั่วโมง",
  "แนะนำสินค้าที่ลูกค้าสนใจ",
  "จดจำบทสนทนากับลูกค้าเดิม",
  "AI สามารถเรียนรู้ธุรกิจสินค้าและบริการได้",
];

const PARTNER_CAP = 0.40;     // Partner ไม่เกิน 40%
const PARTNER_TARGET = 0.35;  // ส่วนลด target 35%
const PROFIT_WARN_THRESHOLD = 0.05; // เตือนเมื่อ margin < 5%

// ============================================================
// ftc_build_ready_package_spec — spec card สำหรับ modal
// (รับ CostPriceScenarioDoc ที่มีข้อมูลครบ)
// ============================================================

export function ftc_build_ready_package_spec(
  scenario: CostPriceScenarioDoc,
): ReadyPackageSpecResult {
  const plan = scenario.inputs.plan.toLowerCase();
  const pkg = (scenario.inputs.packageName ?? "").toLowerCase();
  const isExpired = plan.includes("expired") || pkg.includes("expired");
  const isStorage = !isExpired && (plan.includes("storage") || pkg.includes("storage"));
  const isTrial = scenario.isTrialPackage || plan.includes("trial");

  if (isExpired) {
    const days = scenario.inputs.storageExpireDays ?? 0;
    const months = days >= 30 ? ` (~${Math.round(days / 30)} เดือน)` : "";
    return {
      colorClass: "border-red-200 bg-red-50",
      typeLabel: "Expired Add-on — ระยะเก็บความทรงจำ",
      specLines: [
        { label: "เก็บประวัติสนทนาได้นาน", value: `${days} วัน${months}` },
        { label: "เมื่อครบกำหนด", value: "ระบบลบความทรงจำการสนทนาทั้งหมด", warning: true },
      ],
      standardFeatures: STANDARD_FEATURES,
    };
  }

  if (isStorage) {
    const msgCount = scenario.inputs.messageCount ?? 0;
    const mbPerSentence = scenario.inputs.storageMbPerSentence ?? 8;
    const totalMb = Math.round(msgCount * mbPerSentence);
    return {
      colorClass: "border-emerald-200 bg-emerald-50",
      typeLabel: "Storage Add-on — พื้นที่จัดเก็บ",
      specLines: [
        { label: "ความจุจัดเก็บข้อความ", value: `~${msgCount.toLocaleString("th-TH")} ข้อความ` },
        { label: "พื้นที่จัดเก็บ", value: `~${totalMb.toLocaleString("th-TH")} MB` },
      ],
      standardFeatures: STANDARD_FEATURES,
    };
  }

  const msgCount = scenario.inputs.messageCount ?? 0;
  const tokensPerMsg = scenario.inputs.tokensPerMessage ?? 2500;
  const historyTokens = scenario.inputs.historyTokenCount ?? 0;
  const totalTokens = msgCount * tokensPerMsg + historyTokens;

  // Token เป็นหลัก → ประมาณการณ์ประโยค = totalTokens / tokensPerMsg
  const approxSentences = tokensPerMsg > 0 ? Math.round(totalTokens / tokensPerMsg) : msgCount;
  const specLines: ReadyPackageSpecResult["specLines"] = [
    { label: "Token รวม/เดือน", value: `~${totalTokens.toLocaleString("th-TH")} tokens` },
    { label: "ประมาณการณ์บทสนทนา", value: `~${approxSentences.toLocaleString("th-TH")} ประโยค/เดือน` },
    { label: "Token/ข้อความ", value: `${tokensPerMsg.toLocaleString("th-TH")} tokens` },
    { label: "โควต้าข้อความ", value: `${msgCount.toLocaleString("th-TH")} ข้อความ/เดือน` },
  ];
  if (historyTokens > 0) {
    specLines.splice(2, 0, { label: "Token ความจำย้อนหลัง", value: `${historyTokens.toLocaleString("th-TH")} tokens` });
  }
  if (isTrial && (scenario.inputs.trialDurationDays ?? 0) > 0) {
    specLines.push({ label: "ระยะทดลองใช้", value: `${scenario.inputs.trialDurationDays} วัน` });
  }

  return {
    colorClass: isTrial ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50",
    typeLabel: isTrial ? "Trial — Token & โควต้าทดลองใช้" : "AI Base — Token & โควต้าข้อความ",
    specLines,
    standardFeatures: STANDARD_FEATURES,
  };
}

// ============================================================
// ftc_calc_auto_prices — คำนวณราคา auto + base costs
// ============================================================

function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

export function ftc_calc_auto_prices(items: PriceFields[]): AutoPrices {
  const costRetail  = items.reduce((s, i) => s + i.bestPriceZudobot + i.wht3Zudobot, 0);
  const costPartner = items.reduce((s, i) => s + i.bestPricePartner + i.wht3Partner, 0);
  const sumRetail   = items.reduce((s, i) => s + i.bestPriceZudobot, 0);
  const sumPartner  = items.reduce((s, i) => s + i.bestPricePartner, 0);
  // ต้นทุนจริง = Σ totalCostAr (production cost จาก Excel AR column)
  // fallback เป็น 0 ถ้ายังไม่มีข้อมูล
  const realCostAr  = items.reduce((s, i) => s + (i.totalCostAr ?? 0), 0);

  const autoRetail = roundUp100(costRetail);

  // CLAMP: target=35% discount, floor=costPartner+1%, ceiling=60% of autoRetail
  const target  = autoRetail * (1 - PARTNER_TARGET);     // 65% of autoRetail
  const floor   = costPartner * 1.01;                    // Zudobot wins (1% buffer)
  const ceiling = autoRetail * (1 - PARTNER_CAP);        // 60% of autoRetail

  const autoPartner = roundUp100(Math.max(floor, Math.min(target, ceiling)));

  return { costRetail, costPartner, sumRetail, sumPartner, realCostAr, autoRetail, autoPartner };
}

// ============================================================
// ftc_calc_profit — คำนวณ % กำไรทุกมุม
// ============================================================

export function ftc_calc_profit(
  finalRetail: number,
  finalPartner: number,
  costRetail: number,   // Σ(bestPrice+wht) — ใช้ validation floor
  costPartner: number,
  realCostAr: number,   // Σ totalCostAr — ต้นทุนจริง Production สำหรับ % กำไร Zudobot
): ProfitResult {
  // % กำไร Retail (มุม Zudobot) = (finalRetail - ต้นทุนจริง) / finalRetail
  const profitRetailPct = finalRetail > 0 && realCostAr > 0
    ? ((finalRetail - realCostAr) / finalRetail) * 100
    : finalRetail > 0
    ? ((finalRetail - costRetail) / finalRetail) * 100  // fallback ถ้าไม่มี realCostAr
    : 0;

  // % ส่วนลด Partner (มุม Partner) = (finalRetail - finalPartner) / finalRetail
  const profitPartnerViewPct = finalRetail > 0
    ? ((finalRetail - finalPartner) / finalRetail) * 100 : 0;

  // % กำไร Partner (มุม Zudobot) = (finalPartner - ต้นทุนจริง) / finalPartner
  const profitPartnerZudobotPct = finalPartner > 0 && realCostAr > 0
    ? ((finalPartner - realCostAr) / finalPartner) * 100
    : finalPartner > 0
    ? ((finalPartner - costPartner) / finalPartner) * 100  // fallback
    : 0;

  const savingVsSeparate = costRetail - finalRetail;

  return {
    profitRetailPct,
    profitPartnerViewPct,
    profitPartnerZudobotPct,
    savingVsSeparate,
  };
}

// ============================================================
// ftc_validate_prices — ตรวจสอบ business rules
// ============================================================

export function ftc_validate_prices(
  finalRetail: number,
  finalPartner: number,
  costRetail: number,
  costPartner: number,
  realCostAr = 0,
): ValidationState {
  const profit = ftc_calc_profit(finalRetail, finalPartner, costRetail, costPartner, realCostAr);

  const retailOk  = finalRetail > costRetail;
  const partnerOk = finalPartner > costPartner;
  const capOk     = profit.profitPartnerViewPct <= PARTNER_CAP * 100;
  const retailWarn  = retailOk  && profit.profitRetailPct < PROFIT_WARN_THRESHOLD * 100;
  const partnerWarn = partnerOk && profit.profitPartnerZudobotPct < PROFIT_WARN_THRESHOLD * 100;

  // canSave: ห้ามขายต่ำกว่าต้นทุนจริง (AR) เท่านั้น — ถ้าไม่มี AR fallback ใช้ costRetail
  const belowActualCost = realCostAr > 0 ? finalRetail < realCostAr : !retailOk;
  const canSave = !belowActualCost;

  const errors: string[] = [];
  if (belowActualCost) errors.push("ราคา Retail ต่ำกว่าต้นทุนจริง (AR) — Zudobot ขาดทุน");
  if (!partnerOk) errors.push("ราคา Partner ต่ำกว่าต้นทุน — Zudobot ขาดทุน");
  if (!capOk)     errors.push(`ส่วนลด Partner เกิน ${PARTNER_CAP * 100}% — กรุณาเพิ่มราคา Partner`);

  return { retailOk, partnerOk, capOk, canSave, retailWarn, partnerWarn, errors };
}

// ============================================================
// ftc_build_grouped_summary — คำอธิบายรวมสำหรับตาราง
// (รับ IReadyPackageItem[] ที่มี spec snapshot)
// ============================================================

function detectType(item: SpecFields): "ai_base" | "storage" | "expired" | "trial" {
  const plan = item.plan.toLowerCase();
  const pkg  = (item.packageName ?? "").toLowerCase();
  if (plan.includes("expired") || pkg.includes("expired")) return "expired";
  if (plan.includes("storage") || pkg.includes("storage")) return "storage";
  if (plan.includes("trial")) return "trial";
  return "ai_base";
}

export function ftc_build_grouped_summary(items: SpecFields[]): GroupedSummaryLine[] {
  const lines: GroupedSummaryLine[] = [];

  // ── AI Base / Trial ──────────────────────────────────────────────
  const aiItems = items.filter((i) => ["ai_base", "trial"].includes(detectType(i)));
  if (aiItems.length > 0) {
    const totalMsg  = aiItems.reduce((s, i) => s + (i.messageCount ?? 0), 0);
    const isTrial   = aiItems.every((i) => detectType(i) === "trial");
    const trialDays = isTrial ? aiItems[0]?.trialDurationDays : undefined;
    const totalTokens = aiItems.reduce((s, i) => {
      const msgs = i.messageCount ?? 0;
      const tpm  = i.tokensPerMessage ?? 2500;
      const hist = i.historyTokenCount ?? 0;
      return s + msgs * tpm + hist;
    }, 0);
    // Token เป็นหลัก → ประมาณการณ์ประโยคจาก totalTokens / avg tokensPerMessage
    const avgTpm = aiItems[0]?.tokensPerMessage ?? 2500;
    const approxSentences = avgTpm > 0 ? Math.round(totalTokens / avgTpm) : totalMsg;
    const detailParts: string[] = [];
    if (totalTokens > 0) detailParts.push(`~${totalTokens.toLocaleString("th-TH")} tokens/เดือน`);
    if (approxSentences > 0) detailParts.push(`~${approxSentences.toLocaleString("th-TH")} ประโยค`);
    if (trialDays)       detailParts.push(`ทดลองใช้ ${trialDays} วัน`);
    lines.push({
      icon: "📱",
      label: isTrial ? "Trial" : "AI Base",
      details: detailParts.length > 0 ? detailParts.join(" · ") : "",
    });
  }

  // ── Storage ──────────────────────────────────────────────────────
  const storageItems = items.filter((i) => detectType(i) === "storage");
  if (storageItems.length > 0) {
    const totalMsg = storageItems.reduce((s, i) => s + (i.messageCount ?? 0), 0);
    const totalMb  = storageItems.reduce((s, i) => s + (i.messageCount ?? 0) * (i.storageMbPerSentence ?? 8), 0);
    const detailParts: string[] = [];
    if (totalMsg > 0) detailParts.push(`~${totalMsg.toLocaleString("th-TH")} ข้อความ`);
    if (totalMb  > 0) detailParts.push(`~${Math.round(totalMb).toLocaleString("th-TH")} MB`);
    lines.push({
      icon: "💾",
      label: "Storage",
      details: detailParts.length > 0 ? detailParts.join(" / ") : "",
    });
  }

  // ── Expired ──────────────────────────────────────────────────────
  const expiredItems = items.filter((i) => detectType(i) === "expired");
  if (expiredItems.length > 0) {
    const days = expiredItems.reduce((max, i) => Math.max(max, i.storageExpireDays ?? 0), 0);
    const months = days >= 30 ? ` (~${Math.round(days / 30)} เดือน)` : "";
    lines.push({
      icon: "🗂",
      label: "Expired",
      details: days > 0 ? `เก็บประวัติ ${days} วัน${months}` : "",
    });
  }

  return lines;
}

export { STANDARD_FEATURES };
