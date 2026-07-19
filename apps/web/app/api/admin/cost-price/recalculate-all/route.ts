/**
 * POST /api/admin/cost-price/recalculate-all
 *
 * Bulk-recalculate all CostPriceScenarios using the current active
 * PricingRateMaster, then refresh ReadyPackage item snapshots so that
 * price cards on the landing page stay consistent.
 *
 * Typical use: run after updating the master rate table (e.g. when
 * Anthropic or Backblaze changes their pricing).
 *
 * Returns: counts of updated scenarios and packages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import {
  fnc_price_cost_cal_ai,
  mapV1InputsToV2,
  type CostPriceInputsV2,
} from "@/lib/pricing/fnc_price_cost_cal_ai";
import type { CostPriceInputs } from "@/lib/pricing/costPriceCalculator";
import {
  getActivePricingRates,
  getActivePricingMaster,
} from "@/lib/pricing/getActivePricingRates";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";
import {
  isCostDataLocked,
  recordAuthFailure,
} from "@/lib/security/costDataGuard";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

function isV2Input(inputs: unknown): inputs is CostPriceInputsV2 {
  return typeof (inputs as CostPriceInputsV2)?.aiModel === "string";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (await isCostDataLocked()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  try {
    await connectDB();
    const [rateConfig, master] = await Promise.all([
      getActivePricingRates(),
      getActivePricingMaster(),
    ]);

    // ── 1. Recalculate all active CostPriceScenarios ──────────────────────────

    const scenarios = await CostPriceScenarioModel.find({ isActive: true }).lean();
    let scenarioUpdatedCount = 0;

    const scenarioBulk = scenarios.map((s) => {
      const rawInputs = s.inputs as CostPriceInputsV2 | CostPriceInputs;

      const v2Base: CostPriceInputsV2 = isV2Input(rawInputs)
        ? rawInputs
        : mapV1InputsToV2(rawInputs as CostPriceInputs);

      // Preserve existing markup values; apply master defaults only if missing
      const v2: CostPriceInputsV2 = {
        ...v2Base,
        zudobotBenefitMultiplier:
          v2Base.zudobotBenefitMultiplier ?? (master?.defaultBenefitMultiplier ?? 6),
        partnerSharePct:
          v2Base.partnerSharePct ?? (master?.defaultPartnerSharePct ?? 0.35),
        discountPct:
          v2Base.discountPct ?? (master?.defaultDiscountPct ?? 0.05),
        rateConfigOverride: rateConfig,
      };

      const calculated = fnc_price_cost_cal_ai(v2);
      scenarioUpdatedCount++;

      return {
        updateOne: {
          filter: { _id: s._id },
          update: { $set: { calculated } },
        },
      };
    });

    if (scenarioBulk.length > 0) {
      await CostPriceScenarioModel.bulkWrite(scenarioBulk);
    }

    // ── 2. Refresh ReadyPackage item snapshots ─────────────────────────────────

    const packages = await ReadyPackageModel.find().lean();
    let packageUpdatedCount = 0;

    // Build a scenario map from the freshly-recalculated data
    const recalcedScenarios = await CostPriceScenarioModel.find(
      { _id: { $in: scenarios.map((s) => s._id) } },
    ).lean();
    const scenarioMap = new Map(recalcedScenarios.map((s) => [String(s._id), s]));

    const packageBulk = packages.map((pkg) => {
      const updatedItems = pkg.items.map((item) => {
        const s = scenarioMap.get(String(item.scenarioId));
        if (!s) return item;
        return {
          ...item,
          bestPriceZudobot:  s.inputs.bestPriceZudobot  ?? item.bestPriceZudobot,
          bestPricePartner:  s.inputs.bestPricePartner   ?? item.bestPricePartner,
          vat7Zudobot:       s.calculated?.vat7Zudobot   ?? item.vat7Zudobot,
          wht3Zudobot:       s.calculated?.wht3Zudobot   ?? item.wht3Zudobot,
          vat7Partner:       s.calculated?.vat7Partner   ?? item.vat7Partner,
          wht3Partner:       s.calculated?.wht3Partner   ?? item.wht3Partner,
          totalCostAr:       s.calculated?.totalCostAr   ?? item.totalCostAr,
          messageCount:      s.inputs.messageCount       ?? item.messageCount,
          storageExpireDays: s.inputs.storageExpireDays  ?? item.storageExpireDays,
          trialDurationDays: s.inputs.trialDurationDays  ?? item.trialDurationDays,
        };
      });

      // Recompute auto retail price: ROUNDUP(Σ(bestPrice+wht), 100)
      const costRetail  = updatedItems.reduce((acc, i) => acc + (i.bestPriceZudobot ?? 0) + (i.wht3Zudobot ?? 0), 0);
      const costPartner = updatedItems.reduce((acc, i) => acc + (i.bestPricePartner ?? 0) + (i.wht3Partner ?? 0), 0);

      // Only auto-update if the package doesn't have a manually-set price
      // We infer "manually set" by checking if finalRetailPrice is already stored
      // (packages with no override will recalc automatically)
      const autoRetail  = Math.ceil(costRetail  / 100) * 100;
      const rawTarget   = autoRetail * 0.65;
      const partnerFloor= costPartner * 1.01;
      const partnerCeil = autoRetail  * 0.60;
      const autoPartner = Math.ceil(
        Math.min(Math.max(rawTarget, partnerFloor), partnerCeil) / 100,
      ) * 100;

      packageUpdatedCount++;

      return {
        updateOne: {
          filter: { _id: pkg._id },
          update: {
            $set: {
              items: updatedItems,
              // Only overwrite auto prices — respect admin-set overrides
              ...(pkg.finalRetailPrice  == null ? { finalRetailPrice:  autoRetail  } : {}),
              ...(pkg.finalPartnerPrice == null ? { finalPartnerPrice: autoPartner } : {}),
            },
          },
        },
      };
    });

    if (packageBulk.length > 0) {
      await ReadyPackageModel.bulkWrite(
        packageBulk as Parameters<typeof ReadyPackageModel.bulkWrite>[0],
      );
    }

    invalidatePublicPricingCache();

    return NextResponse.json({
      ok: true,
      ratesSource:     master ? "db" : "constants",
      scenariosUpdated: scenarioUpdatedCount,
      packagesUpdated:  packageUpdatedCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
