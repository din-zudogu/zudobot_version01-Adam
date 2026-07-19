/**
 * GET /api/public/ready-packages
 *
 * Returns pricing data for the public landing page:
 *   - trialPackages: ReadyPackage where isTrial=true, isActive=true, isOnSale=true
 *   - mainPackages:  ReadyPackage where isTrial=false, isActive=true, isOnSale=true
 *   - addonPlans:    CostPriceScenario where isActive=true AND isOnSale=true
 *
 * Rule: isActive=true AND isOnSale=true are REQUIRED for any item to appear.
 *
 * Cache: public-pricing tag, invalidated when admin saves ReadyPackage or CostPriceScenario.
 */
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { PUBLIC_PRICING_TAG } from "@/lib/pricing/cacheTags";
import { ftc_build_grouped_summary, STANDARD_FEATURES } from "@/lib/pricing/readyPackageSpec";

export const dynamic = "force-dynamic";

const PLAN_CATEGORY_ORDER: Record<string, number> = {
  "AI Base": 0, "Storage Add-on": 1, "Expired Add-on": 2, "Trial": 3,
};

function planCategory(plan: string): string {
  const p = plan.toLowerCase();
  if (p.includes("storage")) return "Storage Add-on";
  if (p.includes("expired")) return "Expired Add-on";
  if (p.includes("trial"))   return "Trial";
  if (p.includes("ai base")) return "AI Base";
  return "อื่นๆ";
}

const getPublicReadyPackages = unstable_cache(
  async () => {
    await connectDB();

    // ── ReadyPackages — isActive=true AND isOnSale=true ───────────
    const packages = await ReadyPackageModel.find({ isActive: true, isOnSale: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    // Hydrate spec snapshot fields from source scenarios for packages saved
    // before the spec snapshot fields were added to the item schema.
    const needsHydration = packages.some((p) =>
      p.items.some((i) => i.messageCount == null),
    );
    if (needsHydration) {
      const idSet = new Set(packages.flatMap((p) => p.items.map((i) => String(i.scenarioId))));
      const srcScenarios = await CostPriceScenarioModel.find(
        { _id: { $in: Array.from(idSet) } },
        {
          "inputs.messageCount": 1, "inputs.inputTokensPerMessage": 1,
          "inputs.outputTokensPerMessage": 1, "inputs.historyTokensPerMonth": 1,
          "inputs.storageMbPerMonth": 1,
          "inputs.storageExpireDays": 1, "inputs.trialDurationDays": 1,
        },
      ).lean();
      const sMap = new Map(srcScenarios.map((s) => [String(s._id), s]));
      for (const pkg of packages) {
        for (const item of pkg.items) {
          if (item.messageCount != null) continue;
          const s = sMap.get(String(item.scenarioId));
          if (!s) continue;
          const row = item as Record<string, unknown>;
          row.messageCount            = s.inputs.messageCount;
          row.inputTokensPerMessage   = s.inputs.inputTokensPerMessage;
          row.outputTokensPerMessage  = s.inputs.outputTokensPerMessage;
          row.historyTokensPerMonth   = s.inputs.historyTokensPerMonth;
          row.storageMbPerMonth       = s.inputs.storageMbPerMonth;
          row.storageExpireDays       = s.inputs.storageExpireDays;
          row.trialDurationDays       = s.inputs.trialDurationDays;
        }
      }
    }

    const shapedPackages = packages.map((pkg) => {
      const grouped = ftc_build_grouped_summary(pkg.items);
      return {
        _id:               pkg._id.toString(),
        name:              pkg.name,
        sortOrder:         pkg.sortOrder,
        isTrial:           pkg.isTrial ?? false,
        trialDays:         pkg.trialDays,
        isPartnerAllowed:  pkg.isPartnerAllowed ?? true,
        finalRetailPrice:  pkg.finalRetailPrice ?? 0,
        finalPartnerPrice: pkg.finalPartnerPrice ?? 0,
        specSummary:       grouped,
        standardFeatures:  STANDARD_FEATURES,
        items: pkg.items.map((item) => ({
          plan:                item.plan,
          packageName:         item.packageName,
          messageCount:           item.messageCount,
          inputTokensPerMessage:  (item as Record<string, unknown>).inputTokensPerMessage,
          outputTokensPerMessage: (item as Record<string, unknown>).outputTokensPerMessage,
          historyTokensPerMonth:  (item as Record<string, unknown>).historyTokensPerMonth,
          storageMbPerMonth:      (item as Record<string, unknown>).storageMbPerMonth,
          storageExpireDays:   item.storageExpireDays,
          trialDurationDays:   item.trialDurationDays,
        })),
      };
    });

    // ── CostPriceScenario add-ons — isActive=true AND isOnSale=true ─
    const scenarios = await CostPriceScenarioModel.find({ isActive: true, isOnSale: true })
      .sort({ sortOrder: 1, updatedAt: -1 })
      .lean();

    const addonPlans = scenarios
      .filter((s) => (s.inputs?.bestPriceZudobot ?? 0) > 0 || (s.isTrialPackage ?? false))
      .sort((a, b) => {
        const catA = PLAN_CATEGORY_ORDER[planCategory(a.inputs?.plan ?? "")] ?? 9;
        const catB = PLAN_CATEGORY_ORDER[planCategory(b.inputs?.plan ?? "")] ?? 9;
        if (catA !== catB) return catA - catB;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      })
      .map((s) => ({
        _id:              s._id.toString(),
        label:            s.label,
        plan:             s.inputs?.plan ?? "",
        packageName:      s.inputs?.packageName ?? "",
        baseAddon:        s.inputs?.baseAddon ?? "Base",
        aiBaseMonths:     s.inputs?.aiBaseMonths ?? 1,
        messageCount:     s.inputs?.messageCount ?? 0,
        storageExpireDays: s.inputs?.storageExpireDays,
        bestPriceZudobot: s.inputs?.bestPriceZudobot ?? 0,
        bestPricePartner: s.inputs?.bestPricePartner ?? 0,
        isTrialPackage:   s.isTrialPackage ?? false,
        isBestPriceHighlight: s.isBestPriceHighlight ?? false,
        packageDescription: s.packageDescription ?? "",
      }));

    return { shapedPackages, addonPlans };
  },
  ["public-ready-packages"],
  { tags: [PUBLIC_PRICING_TAG], revalidate: 3600 },
);

export async function GET() {
  try {
    const { shapedPackages, addonPlans } = await getPublicReadyPackages();
    const trialPackages = shapedPackages.filter(p => p.isTrial);
    const mainPackages  = shapedPackages.filter(p => !p.isTrial);

    return NextResponse.json(
      {
        ok: true,
        trialPackages,
        mainPackages,
        addonPlans,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err: unknown) {
    console.error("[/api/public/ready-packages]", err);
    return NextResponse.json(
      { ok: false, error: "server_error", trialPackages: [], mainPackages: [], addonPlans: [] },
      { status: 500 },
    );
  }
}
