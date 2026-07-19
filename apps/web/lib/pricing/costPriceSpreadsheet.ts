import {
  fnc_price_cost_cal_ai,
  mapV1InputsToV2,
  type CostPriceInputsV2,
} from "./fnc_price_cost_cal_ai";
import {
  DEFAULT_UNIT_COSTS,
  DEFAULT_UNIT_COST_ANCHOR_BJ,
  type CostPriceCalculated,
} from "./costPriceCalculator";
import type { CostPriceInputs } from "./costPriceCalculator";

export type CostPriceExportRow = Record<string, string | number | boolean>;

/** Column order for CSV/Excel — inputs + v1.2.0 metadata + calculated (readable export) */
export const COST_PRICE_COLUMNS = [
  "label",
  "sort_order",
  "is_active",
  // v1.2.0 root-level metadata fields (Excel AE/AF + Admin extension)
  "is_best_price_highlight",
  "is_trial_package",
  "package_description",
  "share_to_knowledge_base",
  // Identity inputs (A–F)
  "plan",
  "package_name",
  "base_addon",
  "storage_expire_days",
  "trial_duration_days",
  "ai_base_months",
  // Pricing policy (G, K, R, AC, AD)
  "zudobot_benefit_multiplier",
  "partner_share_pct",
  "discount_pct",
  "best_price_zudobot",
  "best_price_partner",
  "pricing_mode",
  "reference_unit_cost_aq",
  "unit_cost_anchor_message_count",
  // Unit costs (AI–AQ)
  "unit_cost_ai_core",
  "unit_cost_mongodb",
  "unit_cost_aws",
  "unit_cost_s3",
  "unit_cost_vat_intl",
  "unit_cost_fx_risk",
  "unit_cost_payment_gateway",
  "cost_per_token",
  "cost_per_mb",
  // Usage / storage (BJ, BG, BI, BH, BO, BN, BK, BL)
  "message_count",
  "history_token_count",
  "tokens_per_message",
  "token_divisor",
  "storage_mb_per_sentence",
  "storage_cost_per_mb",
  "include_retention_storage_cost",
  // Calculated outputs (read-only on import)
  "monthly_total_cost_aq",
  "zudobot_benefit_thb",
  "partner_benefit_thb",
  "price_month_zudobot",
  "price_month_partner",
  "price_after_vat_zudobot",
  "price_after_vat_partner",
  "estimate_partner_benefit_thb",
  "estimate_partner_benefit_pct",
] as const;

function num(v: unknown, fallback = 0): number {
  if (v === "" || v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "ใช่";
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function scenarioToExportRow(
  doc: {
    label: string;
    sortOrder: number;
    isActive: boolean;
    packageDescription?: string;
    shareToKnowledgeBase?: boolean;
    isBestPriceHighlight?: boolean;
    isTrialPackage?: boolean;
    inputs: CostPriceInputsV2;
    calculated: CostPriceCalculated;
  },
): CostPriceExportRow {
  const i = doc.inputs;
  const c = doc.calculated;
  return {
    label: doc.label,
    sort_order: doc.sortOrder,
    is_active: doc.isActive,
    is_best_price_highlight: doc.isBestPriceHighlight ?? false,
    is_trial_package: doc.isTrialPackage ?? false,
    package_description: doc.packageDescription ?? "",
    share_to_knowledge_base: doc.shareToKnowledgeBase ?? false,
    // Identity
    plan: i.plan,
    package_name: i.packageName,
    base_addon: i.baseAddon,
    storage_expire_days: i.storageExpireDays ?? "",
    trial_duration_days: i.trialDurationDays ?? "",
    ai_base_months: i.aiBaseMonths,
    // Pricing policy
    zudobot_benefit_multiplier: i.zudobotBenefitMultiplier,
    partner_share_pct: i.partnerSharePct,
    discount_pct: i.discountPct,
    best_price_zudobot: i.bestPriceZudobot,
    best_price_partner: i.bestPricePartner,
    pricing_mode: i.pricingMode,
    reference_unit_cost_aq: i.referenceUnitCostAq ?? "",
    // V2 AI token fields
    ai_model: i.aiModel,
    input_tokens_per_message: i.inputTokensPerMessage,
    output_tokens_per_message: i.outputTokensPerMessage,
    history_tokens_per_month: i.historyTokensPerMonth ?? 0,
    prompt_caching_enabled: i.promptCachingEnabled ?? false,
    // V2 storage fields
    storage_provider: i.storageProvider,
    storage_mb_per_month: i.storageMbPerMonth,
    egress_mb_per_month: i.egressMbPerMonth ?? 0,
    use_cloudflare_b2: i.useCloudflareB2 ?? true,
    // V2 payment fields
    payment_method: i.paymentMethod,
    monthly_transaction_amount_thb: i.monthlyTransactionAmountThb ?? 0,
    // Usage
    message_count: i.messageCount,
    include_retention_storage_cost: i.includeRetentionStorageCost ?? false,
    // Calculated (read-only)
    monthly_total_cost_aq: c.totalCostAr,
    zudobot_benefit_thb: c.zudobotBenefitThb,
    partner_benefit_thb: c.partnerBenefitThb,
    price_month_zudobot: c.priceMonthZudobot,
    price_month_partner: c.priceMonthPartner,
    price_after_vat_zudobot: c.priceAfterVatZudobot,
    price_after_vat_partner: c.priceAfterVatPartner,
    estimate_partner_benefit_thb: c.estimatePartnerBenefitThb,
    estimate_partner_benefit_pct: c.estimatePartnerBenefitPct,
  };
}

export function exportRowToScenarioPayload(row: CostPriceExportRow): {
  label: string;
  sortOrder: number;
  isActive: boolean;
  packageDescription?: string;
  shareToKnowledgeBase: boolean;
  isBestPriceHighlight: boolean;
  isTrialPackage: boolean;
  inputs: CostPriceInputsV2;
  calculated: CostPriceCalculated;
} {
  const storageDays = row.storage_expire_days;
  const trialDays   = row.trial_duration_days;
  const storedTokens = row.stored_tokens;
  const chatsPerDay  = row.chats_per_day_estimate;
  const refAq        = row.reference_unit_cost_aq;

  // Build V1-style object from row first, then map to V2
  const v1: CostPriceInputs = {
    ...DEFAULT_UNIT_COSTS,
    plan:        str(row.plan) || "Unknown",
    packageName: str(row.package_name),
    baseAddon:   str(row.base_addon) || "Base",
    storageExpireDays:  storageDays === "" ? undefined : num(storageDays),
    trialDurationDays:  trialDays   === "" ? undefined : num(trialDays),
    aiBaseMonths:       num(row.ai_base_months, 1),
    zudobotBenefitMultiplier: num(row.zudobot_benefit_multiplier, 6),
    partnerSharePct:    num(row.partner_share_pct, 0.35),
    discountPct:        num(row.discount_pct, 0),
    bestPriceZudobot:   num(row.best_price_zudobot, 0),
    bestPricePartner:   num(row.best_price_partner, 0),
    pricingMode: str(row.pricing_mode) === "reference_multiple" ? "reference_multiple" : "unit_calc",
    referenceUnitCostAq: refAq === "" ? undefined : num(refAq),
    unitCostAnchorMessageCount: num(row.unit_cost_anchor_message_count, DEFAULT_UNIT_COST_ANCHOR_BJ),
    unitCostAiCore:          num(row.unit_cost_ai_core, DEFAULT_UNIT_COSTS.unitCostAiCore),
    unitCostDatabase:        num(row.unit_cost_mongodb, DEFAULT_UNIT_COSTS.unitCostDatabase),
    unitCostAws:             num(row.unit_cost_aws, DEFAULT_UNIT_COSTS.unitCostAws),
    unitCostS3:              num(row.unit_cost_s3, DEFAULT_UNIT_COSTS.unitCostS3),
    unitCostVatIntl:         num(row.unit_cost_vat_intl, DEFAULT_UNIT_COSTS.unitCostVatIntl),
    unitCostFxRisk:          num(row.unit_cost_fx_risk, DEFAULT_UNIT_COSTS.unitCostFxRisk),
    unitCostPaymentGateway:  num(row.unit_cost_payment_gateway, DEFAULT_UNIT_COSTS.unitCostPaymentGateway),
    costPerToken:            num(row.cost_per_token, DEFAULT_UNIT_COSTS.costPerToken),
    costPerMb:               num(row.cost_per_mb, DEFAULT_UNIT_COSTS.costPerMb),
    messageCount:            num(row.message_count, 1000),
    historyTokenCount:       num(row.history_token_count, 0),
    tokensPerMessage:        num(row.tokens_per_message, 2500),
    tokenDivisor:            num(row.token_divisor, 1),
    storageMbPerSentence:    num(row.storage_mb_per_sentence, 8),
    storageCostPerMb:        num(row.storage_cost_per_mb, 0.01),
    storedTokens:     storedTokens === "" ? undefined : num(storedTokens),
    chatsPerDayEstimate: chatsPerDay === "" ? undefined : num(chatsPerDay),
    includeRetentionStorageCost: bool(row.include_retention_storage_cost),
  };

  // Override V2 fields if present in the row
  const inputs: CostPriceInputsV2 = {
    ...mapV1InputsToV2(v1),
    ...(row.ai_model        ? { aiModel: row.ai_model as CostPriceInputsV2["aiModel"] } : {}),
    ...(row.storage_provider? { storageProvider: row.storage_provider as CostPriceInputsV2["storageProvider"] } : {}),
    ...(row.payment_method  ? { paymentMethod: row.payment_method as CostPriceInputsV2["paymentMethod"] } : {}),
  };

  const calculated = fnc_price_cost_cal_ai(inputs);
  const label =
    str(row.label) ||
    `${inputs.plan} — ${inputs.packageName} (${inputs.aiBaseMonths} เดือน)`;
  const descRaw = str(row.package_description);

  return {
    label,
    sortOrder: num(row.sort_order, 0),
    isActive: row.is_active === "" ? true : bool(row.is_active),
    packageDescription: descRaw || undefined,
    shareToKnowledgeBase: bool(row.share_to_knowledge_base),
    isBestPriceHighlight: bool(row.is_best_price_highlight),
    isTrialPackage: bool(row.is_trial_package),
    inputs,
    calculated,
  };
}

function escapeCsvCell(v: string | number | boolean): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function scenariosToCsv(
  rows: CostPriceExportRow[],
): string {
  const header = COST_PRICE_COLUMNS.join(",");
  const body = rows.map((row) =>
    COST_PRICE_COLUMNS.map((col) => escapeCsvCell(row[col] ?? "")).join(","),
  );
  return "\uFEFF" + [header, ...body].join("\r\n");
}

export function csvToExportRows(csvText: string): CostPriceExportRow[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: CostPriceExportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    const row: CostPriceExportRow = {};
    headers.forEach((h, idx) => {
      const key = h.replace(/\s+/g, "_");
      if ((COST_PRICE_COLUMNS as readonly string[]).includes(key)) {
        row[key] = cells[idx] ?? "";
      }
    });
    if (str(row.plan) || str(row.label)) rows.push(row);
  }

  return rows;
}

export async function scenariosToXlsxBuffer(
  rows: CostPriceExportRow[],
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const sheetData = [
    [...COST_PRICE_COLUMNS],
    ...rows.map((row) => COST_PRICE_COLUMNS.map((col) => row[col] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CostPrice");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(buf);
}

export async function xlsxBufferToExportRows(buffer: Buffer): Promise<CostPriceExportRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return json
    .map((raw) => {
      const row: CostPriceExportRow = {};
      for (const col of COST_PRICE_COLUMNS) {
        const val = raw[col] ?? raw[col.toUpperCase()];
        if (val !== undefined) row[col] = val as string | number | boolean;
      }
      return row;
    })
    .filter((row) => str(row.plan) || str(row.label));
}
