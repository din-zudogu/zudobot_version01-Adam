/**
 * POST /api/admin/cost-price/preview
 *
 * Real-time calculation preview — computes cost & price from given inputs
 * using the active DB rate master.  No DB write.  Powers the live
 * auto-calculate display in the scenario / VIP / ready-package forms.
 *
 * Also returns the active master's default markup values so the frontend
 * can pre-populate benefitMultiplier, partnerSharePct, discountPct.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
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
import {
  isCostDataLocked,
  recordAuthFailure,
} from "@/lib/security/costDataGuard";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

function isV2Input(inputs: unknown): inputs is CostPriceInputsV2 {
  return typeof (inputs as CostPriceInputsV2)?.aiModel === "string";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (await isCostDataLocked()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const rawInputs = body.inputs as CostPriceInputsV2 | CostPriceInputs | undefined;
  if (!rawInputs) {
    return NextResponse.json({ error: "inputs_required" }, { status: 400 });
  }

  try {
    // Load active DB rates + master defaults
    const [rateConfig, master] = await Promise.all([
      getActivePricingRates(),
      getActivePricingMaster(),
    ]);

    // Normalise to V2
    const v2Base: CostPriceInputsV2 = isV2Input(rawInputs)
      ? (rawInputs as CostPriceInputsV2)
      : mapV1InputsToV2(rawInputs as CostPriceInputs);

    // Apply master defaults for markup fields if caller left them unset
    const v2: CostPriceInputsV2 = {
      ...v2Base,
      zudobotBenefitMultiplier:
        v2Base.zudobotBenefitMultiplier ?? (master?.defaultBenefitMultiplier ?? 6),
      partnerSharePct:
        v2Base.partnerSharePct ?? (master?.defaultPartnerSharePct ?? 0.35),
      discountPct:
        v2Base.discountPct ?? (master?.defaultDiscountPct ?? 0.05),
      // Always inject active DB rates (overrides any client-provided rates)
      rateConfigOverride: rateConfig,
    };

    const calculated = fnc_price_cost_cal_ai(v2);

    // Return the defaults so the form can pre-populate its fields
    const markupDefaults = {
      defaultBenefitMultiplier: master?.defaultBenefitMultiplier ?? 6,
      defaultPartnerSharePct:   master?.defaultPartnerSharePct   ?? 0.35,
      defaultDiscountPct:       master?.defaultDiscountPct       ?? 0.05,
    };

    return NextResponse.json({ calculated, markupDefaults, ratesSource: master ? "db" : "constants" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
