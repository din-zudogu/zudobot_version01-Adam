/**
 * Backend-only pricing authority — ไม่ส่ง internal cost ออก client
 * ใช้ก่อนสร้าง Stripe session; ไม่เชื่อราคาจาก frontend payload
 */
import { connectDB } from "@/lib/db/connect";
import {
  MasterPlanConfigModel,
  type IMasterPlanConfig,
} from "@/lib/db/models/MasterPlanConfig";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";

export type CheckoutBuyerRole = "CUSTOMER" | "PARTNER";

/** Legacy checkout slug → Master plan_code (รายเดือน) */
const LEGACY_BASE_TO_MASTER: Record<string, string> = {
  starter: "base_starter_1m",
  growth: "base_growth_1m",
  pro: "base_pro_1m",
  master: "base_pro_1m",
};

const LEGACY_QUOTA_TO_MASTER: Record<string, string> = {
  quota_1k: "quota_1k_1m",
  quota_5k: "quota_5k_1m",
  quota_20k: "quota_20k_1m",
};

const LEGACY_RETENTION_TO_MASTER: Record<string, string> = {
  standard: "ret_7d_1m",
  ret_7d: "ret_7d_1m",
  "1month": "ret_30d_1m",
  ret_30d: "ret_30d_1m",
  "3months": "ret_90d_1m",
  ret_90d: "ret_90d_1m",
  "6months": "ret_90d_1m",
  lifetime: "ret_life_1m",
  ret_life: "ret_life_1m",
};

export type ResolvedPlanPrice = {
  planCode: string;
  source: "MasterPlanConfig" | "PackageConfig";
  retailPrice: number;
  partnerPrice: number;
};

export type CheckoutPriceResolution = {
  buyerRole: CheckoutBuyerRole;
  lines: ResolvedPlanPrice[];
  /** ยอดที่ลูกค้าปลายทางควรจ่าย (รวม retail) */
  customerChargeThb: number;
  /** ยอดที่ Zudobot รับจากผู้ซื้อ (CUSTOMER=retail, PARTNER=partner รวม) */
  zudobotReceivableThb: number;
};

async function findMasterByCode(planCode: string): Promise<IMasterPlanConfig | null> {
  const doc = await MasterPlanConfigModel.findOne({
    plan_code: planCode,
    is_active: true,
  }).lean<IMasterPlanConfig | null>();
  return doc;
}

async function resolveLine(
  legacyOrCode: string,
  legacyMap: Record<string, string>
): Promise<ResolvedPlanPrice | null> {
  const code = legacyMap[legacyOrCode] ?? legacyOrCode;
  const master = await findMasterByCode(code);
  if (master) {
    return {
      planCode: master.plan_code,
      source: "MasterPlanConfig",
      retailPrice: master.retail_price,
      partnerPrice: master.partner_cost,
    };
  }

  const legacy = await PackageConfigModel.findOne({
    packageId: legacyOrCode,
    isActive: true,
  }).lean();
  if (!legacy) return null;

  return {
    planCode: legacy.packageId,
    source: "PackageConfig",
    retailPrice: legacy.priceThb,
    partnerPrice: legacy.partnerCost ?? legacy.wholesalePriceThb ?? 0,
  };
}

/**
 * ดึงราคาจาก Master Config (หรือ legacy fallback) ตาม planCode / legacy ids
 */
export async function resolveCheckoutPricingFromAuthority(input: {
  buyerRole: CheckoutBuyerRole;
  planCode?: string;
  planId?: string;
  memoryId?: string;
  quotaId?: string;
  retentionId?: string;
}): Promise<CheckoutPriceResolution | { error: string }> {
  await connectDB();

  const lines: ResolvedPlanPrice[] = [];

  if (input.planCode) {
    const one = await resolveLine(input.planCode, {});
    if (!one) return { error: "invalid_plan_code" };
    lines.push(one);
  } else if (input.planId) {
    const base = await resolveLine(input.planId, LEGACY_BASE_TO_MASTER);
    if (!base) return { error: "invalid_base_plan" };
    lines.push(base);

    if (input.memoryId) {
      const m = await resolveLine(input.memoryId, LEGACY_QUOTA_TO_MASTER);
      if (m) lines.push(m);
    }
    if (input.quotaId) {
      const q = await resolveLine(input.quotaId, LEGACY_QUOTA_TO_MASTER);
      if (q) lines.push(q);
    }
    if (input.retentionId) {
      const r = await resolveLine(input.retentionId, LEGACY_RETENTION_TO_MASTER);
      if (r) lines.push(r);
    }
  } else {
    return { error: "missing_plan_reference" };
  }

  const customerChargeThb = lines.reduce((s, l) => s + Math.max(0, l.retailPrice), 0);

  const zudobotReceivableThb =
    input.buyerRole === "PARTNER"
      ? lines.reduce((s, l) => s + Math.max(0, l.partnerPrice), 0)
      : customerChargeThb;

  return {
    buyerRole: input.buyerRole,
    lines,
    customerChargeThb,
    zudobotReceivableThb,
  };
}

/** บทบาทจาก session role string */
export function mapSessionRoleToBuyerRole(
  role: string | undefined
): CheckoutBuyerRole {
  if (role === "partner") return "PARTNER";
  return "CUSTOMER";
}
