import type { PublicPricingSnapshot } from "@/lib/pricing/buildPublicPricing";
import type { PublicPackage } from "@/lib/pricing/publicPackageTypes";

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

const TIER_CHECKOUT: Record<string, string> = {
  Starter: "starter",
  Growth: "pro",
  Pro: "pro",
  Master: "master",
};

function quotaCheckoutId(planCode: string): string {
  if (planCode.startsWith("quota_1k")) return "quota_1k";
  if (planCode.startsWith("quota_5k")) return "quota_5k";
  if (planCode.startsWith("quota_20k")) return "quota_20k";
  return planCode;
}

function retentionDisplayPrice(price: number): string {
  if (price < 0) return "Custom";
  if (price === 0) return "ฟรี";
  return price.toLocaleString("th-TH");
}

function formatThb(n: number): string {
  if (n < 0) return "Custom";
  if (n === 0) return "ฟรี";
  return `฿${n.toLocaleString("th-TH")}`;
}

/** แปลง API packages → snapshot เดิมที่ PricingSection ใช้อยู่ (backward compatible) */
export function mapPublicPackagesToSnapshot(
  packages: PublicPackage[],
  cycle = "1m"
): PublicPricingSnapshot {
  const monthly = packages.filter((p) => p.cycle === cycle);

  const basePlans = monthly
    .filter((p) => p.type === "BASE" && p.retailPrice >= 0)
    .map((p) => ({
      id: p.planCode,
      tier: p.planTier,
      label: p.name,
      checkoutPlanId: TIER_CHECKOUT[p.planTier] ?? "starter",
      retailPrice: p.retailPrice,
      retailInclVat: p.retailPrice,
      messageQuota: p.msgQuota,
      isPopular: p.planTier === "Pro" || p.planTier === "Growth",
      features: BASE_FEATURES[p.planTier] ?? [p.name],
    }));

  const quotaAddons = monthly
    .filter((p) => p.type === "QUOTA_ADDON")
    .map((p) => ({
      id: p.planCode,
      checkoutAddonId: quotaCheckoutId(p.planCode),
      label: p.name,
      extraMessages: p.msgQuota,
      retailPrice: p.retailPrice,
      tag: p.planTier.includes("5") ? "คุ้มค่า" : null,
    }));

  const retentionAddons = monthly
    .filter((p) => p.type === "RETENTION_ADDON")
    .map((p) => ({
      id: p.planCode,
      periodLabel: p.msgQuota <= 0 ? "ตลอดไป" : `${p.msgQuota} วัน`,
      retentionDays: p.msgQuota,
      retailPrice: p.retailPrice,
      displayPrice: retentionDisplayPrice(p.retailPrice),
      tag:
        p.msgQuota === 7
          ? "มาตรฐาน"
          : p.msgQuota < 0
            ? "สำหรับองค์กร"
            : p.msgQuota >= 90
              ? "ยอดนิยม"
              : null,
    }));

  const TIER_DISPLAY: Record<string, string> = {
    Starter: "🌱 Starter",
    Growth: "📈 Growth",
    Pro: "⭐ Pro",
    Master: "👑 Master",
  };

  const partnerPlans = basePlans
    .filter((b) => b.retailPrice > 0)
    .map((b) => {
      const src = monthly.find((p) => p.planCode === b.id);
      const retail = b.retailPrice;
      const partner = src?.partnerPrice ?? 0;
      const profit = retail - partner;
      const marginPct = retail > 0 ? Math.round((profit / retail) * 100) : 0;
      return {
        id: b.id,
        name: TIER_DISPLAY[b.tier] ?? b.label,
        msgs:
          b.messageQuota < 0
            ? "ไม่จำกัด"
            : b.messageQuota.toLocaleString("th-TH"),
        retail: formatThb(retail),
        wholesale: formatThb(partner),
        profit: formatThb(profit),
        pct: `${marginPct}%`,
        popular: b.isPopular,
        retailNum: retail,
        profitNum: profit,
      };
    });

  return {
    basePlans,
    quotaAddons,
    retentionAddons,
    partnerPlans,
    updatedAt: new Date().toISOString(),
  };
}
