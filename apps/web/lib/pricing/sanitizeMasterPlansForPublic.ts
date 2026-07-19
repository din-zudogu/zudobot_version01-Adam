import type { IMasterPlanConfig, PlanCategory } from "@/lib/db/models/MasterPlanConfig";
import type { PublicPackage, PublicPackageType } from "@/lib/pricing/publicPackageTypes";

function mapCategory(cat: PlanCategory): PublicPackageType {
  if (cat === "BASE_PLAN") return "BASE";
  if (cat === "QUOTA_ADDON") return "QUOTA_ADDON";
  return "RETENTION_ADDON";
}

function cycleLabel(months: number): string {
  return `${months}m`;
}

/**
 * แปลง MasterPlanConfig → รายการ public ที่ปลอดภัย
 * ไม่ส่ง zudobot_internal_cost, vat_rate สำหรับคำนวณกำไร Zudobot ฯลฯ
 */
export function sanitizeMasterPlansForPublic(
  plans: IMasterPlanConfig[]
): PublicPackage[] {
  return plans
    .filter((p) => p.is_active)
    .map((p) => ({
      id: String(p._id),
      planCode: p.plan_code,
      name: p.label_th,
      type: mapCategory(p.plan_category),
      cycle: cycleLabel(p.billing_cycle_months),
      msgQuota:
        p.plan_category === "BASE_PLAN"
          ? p.message_quota
          : p.plan_category === "QUOTA_ADDON"
            ? p.extra_message_quota
            : p.retention_days,
      retailPrice: p.retail_price,
      partnerPrice: p.partner_cost,
      planTier: p.plan_tier,
      sortOrder: p.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
