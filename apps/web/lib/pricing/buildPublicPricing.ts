import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import {
  MasterPlanConfigModel,
  computePlanFinancials,
  type IMasterPlanConfig,
} from "@/lib/db/models/MasterPlanConfig";
import { PARTNER_BENEFITS_TAG, PUBLIC_PRICING_TAG } from "@/lib/pricing/cacheTags";

export type PublicBasePlan = {
  id: string;
  tier: string;
  label: string;
  checkoutPlanId: string;
  retailPrice: number;
  retailInclVat: number;
  messageQuota: number;
  isPopular: boolean;
  features: string[];
};

export type PublicQuotaAddon = {
  id: string;
  checkoutAddonId: string;
  label: string;
  extraMessages: number;
  retailPrice: number;
  tag: string | null;
};

export type PublicRetentionAddon = {
  id: string;
  periodLabel: string;
  retentionDays: number;
  retailPrice: number;
  displayPrice: string;
  tag: string | null;
};

export type PublicPartnerPlan = {
  id: string;
  name: string;
  msgs: string;
  retail: string;
  wholesale: string;
  profit: string;
  pct: string;
  popular: boolean;
  retailNum: number;
  profitNum: number;
};

export type PublicPricingSnapshot = {
  basePlans: PublicBasePlan[];
  quotaAddons: PublicQuotaAddon[];
  retentionAddons: PublicRetentionAddon[];
  partnerPlans: PublicPartnerPlan[];
  updatedAt: string;
};

function tierToCheckoutPlanId(tier: string): string {
  const map: Record<string, string> = {
    Starter: "starter",
    Growth: "pro",
    Pro: "pro",
    Master: "master",
  };
  return map[tier] ?? "starter";
}

function quotaCodeToCheckoutId(planCode: string): string {
  if (planCode.startsWith("quota_1k")) return "quota_1k";
  if (planCode.startsWith("quota_5k")) return "quota_5k";
  if (planCode.startsWith("quota_20k")) return "quota_20k";
  return planCode;
}

const BASE_FEATURES: Record<string, string[]> = {
  Starter: [
    "บอทตอบลูกค้า 24/7",
    "Knowledge Base ไม่จำกัด",
    "Widget embed พร้อมใช้",
    "Analytics พื้นฐาน",
    "Email support",
  ],
  Growth: [
    "ทุกอย่างใน Starter",
    "โควต้าข้อความเพิ่มขึ้น",
    "เชื่อมต่อช่องทางได้มากขึ้น",
    "Priority support",
    "Analytics ครบ",
  ],
  Pro: [
    "ทุกอย่างใน Starter",
    "Buying Signal Detection",
    "LINE Notify แจ้งเตือน",
    "Analytics ครบ",
    "Priority support",
    "Domain Whitelist",
  ],
  Master: [
    "ทุกอย่างใน Pro",
    "Visitor Personality Learning",
    "Custom Engagement Rules",
    "ส่งออกข้อมูล Analytics",
    "Dedicated support",
    "SLA 99.9%",
  ],
};

function formatThb(n: number): string {
  if (n < 0) return "Custom";
  if (n === 0) return "ฟรี";
  return `฿${n.toLocaleString("th-TH")}`;
}

function formatQuota(n: number): string {
  if (n < 0) return "ไม่จำกัด";
  return n.toLocaleString("th-TH");
}

function retentionDisplayPrice(price: number): string {
  if (price < 0) return "Custom";
  if (price === 0) return "ฟรี";
  return String(price.toLocaleString("th-TH"));
}

function buildFromPlans(plans: IMasterPlanConfig[]): PublicPricingSnapshot {
  const monthly = plans.filter((p) => p.is_active && p.billing_cycle_months === 1);

  const basePlans: PublicBasePlan[] = monthly
    .filter((p) => p.plan_category === "BASE_PLAN" && p.retail_price >= 0)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => {
      const f = computePlanFinancials(p);
      return {
        id: p.plan_code,
        tier: p.plan_tier,
        label: p.label_th,
        checkoutPlanId: tierToCheckoutPlanId(p.plan_tier),
        retailPrice: p.retail_price,
        retailInclVat: f.retail_incl_vat,
        messageQuota: p.message_quota,
        isPopular: p.plan_tier === "Pro" || p.plan_tier === "Growth",
        features: BASE_FEATURES[p.plan_tier] ?? [p.label_th],
      };
    });

  const quotaAddons: PublicQuotaAddon[] = monthly
    .filter((p) => p.plan_category === "QUOTA_ADDON")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.plan_code,
      checkoutAddonId: quotaCodeToCheckoutId(p.plan_code),
      label: p.label_th,
      extraMessages: p.extra_message_quota,
      retailPrice: p.retail_price,
      tag: p.plan_tier.includes("5") ? "คุ้มค่า" : null,
    }));

  const retentionAddons: PublicRetentionAddon[] = monthly
    .filter((p) => p.plan_category === "RETENTION_ADDON")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.plan_code,
      periodLabel: p.retention_days < 0 ? "ตลอดไป" : `${p.retention_days} วัน`,
      retentionDays: p.retention_days,
      retailPrice: p.retail_price,
      displayPrice: retentionDisplayPrice(p.retail_price),
      tag:
        p.retention_days === 7
          ? "มาตรฐาน"
          : p.retention_days < 0
            ? "สำหรับองค์กร"
            : p.plan_tier.includes("90")
              ? "ยอดนิยม"
              : null,
    }));

  const partnerPlans: PublicPartnerPlan[] = basePlans
    .filter((b) => b.retailPrice > 0)
    .map((b) => {
      const src = monthly.find((p) => p.plan_code === b.id);
      if (!src) {
        return {
          id: b.id,
          name: b.label,
          msgs: formatQuota(b.messageQuota),
          retail: formatThb(b.retailPrice),
          wholesale: "—",
          profit: "—",
          pct: "—",
          popular: b.isPopular,
          retailNum: b.retailPrice,
          profitNum: 0,
        };
      }
      const f = computePlanFinancials(src);
      const marginPct = Math.round(f.partner_gross_margin_pct * 100);
      return {
        id: b.id,
        name: b.label,
        msgs: formatQuota(b.messageQuota),
        retail: formatThb(b.retailPrice),
        wholesale: formatThb(src.partner_cost),
        profit: formatThb(f.partner_gross_profit),
        pct: `${marginPct}%`,
        popular: b.isPopular,
        retailNum: b.retailPrice,
        profitNum: f.partner_gross_profit,
      };
    });

  const latest = plans.reduce((max, p) => {
    const t = p.updatedAt?.getTime() ?? 0;
    return t > max ? t : max;
  }, 0);

  return {
    basePlans,
    quotaAddons,
    retentionAddons,
    partnerPlans,
    updatedAt: latest ? new Date(latest).toISOString() : new Date().toISOString(),
  };
}

async function loadPublicPricingUncached(): Promise<PublicPricingSnapshot> {
  await connectDB();
  const plans = await MasterPlanConfigModel.find().lean<IMasterPlanConfig[]>();
  return buildFromPlans(plans);
}

/** Cached read — invalidated by pricingSyncService via revalidateTag. */
export function getCachedPublicPricing(): Promise<PublicPricingSnapshot> {
  return unstable_cache(loadPublicPricingUncached, ["public-pricing-snapshot"], {
    tags: [PUBLIC_PRICING_TAG, PARTNER_BENEFITS_TAG],
    revalidate: 3600,
  })();
}
