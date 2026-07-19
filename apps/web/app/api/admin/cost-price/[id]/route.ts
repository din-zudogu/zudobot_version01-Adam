import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import {
  fnc_price_cost_cal_ai,
  mapV1InputsToV2,
  type CostPriceInputsV2,
} from "@/lib/pricing/fnc_price_cost_cal_ai";
import type { CostPriceInputs } from "@/lib/pricing/costPriceCalculator";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";
import {
  getActivePricingRates,
  getActivePricingMaster,
} from "@/lib/pricing/getActivePricingRates";
import {
  isCostDataLocked,
  recordAuthFailure,
  generateHoneypotScenarios,
} from "@/lib/security/costDataGuard";

function isV2Input(inputs: unknown): inputs is CostPriceInputsV2 {
  return typeof (inputs as CostPriceInputsV2)?.aiModel === "string";
}

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (token?.role !== "admin" && token?.role !== "super_admin") {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Honeypot: return first fake scenario when locked
  if (await isCostDataLocked()) {
    const fake = generateHoneypotScenarios()[0] ?? {};
    return NextResponse.json({ scenario: fake });
  }
  const { id } = await params;
  try {
    await connectDB();
    const scenario = await CostPriceScenarioModel.findById(id).lean();
    if (!scenario) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ scenario });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (await isCostDataLocked()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await connectDB();
    const inputs = body.inputs as CostPriceInputs | undefined;
    const update: Record<string, unknown> = {};
    if (body.label) update.label = body.label;
    if (body.sortOrder != null) update.sortOrder = body.sortOrder;
    if (body.isActive != null) update.isActive = body.isActive;
    if (body.referenceScenarioId != null) update.referenceScenarioId = body.referenceScenarioId;
    // v1.2.0 root-level fields
    if (body.packageDescription !== undefined) {
      const desc = body.packageDescription === null || body.packageDescription === ""
        ? undefined
        : String(body.packageDescription).trim().slice(0, 1000) || undefined;
      update.packageDescription = desc;
    }
    if (body.shareToKnowledgeBase != null) {
      update.shareToKnowledgeBase = body.shareToKnowledgeBase === true;
    }
    if (body.isBestPriceHighlight != null) {
      update.isBestPriceHighlight = body.isBestPriceHighlight === true;
    }
    if (body.isTrialPackage != null) {
      update.isTrialPackage = body.isTrialPackage === true;
    }
    if (body.isOnSale != null) {
      update.isOnSale = body.isOnSale === true;
    }
    if (body.isPartnerAllowed != null) {
      update.isPartnerAllowed = body.isPartnerAllowed !== false;
    }
    if (inputs) {
      const [rateConfig, master] = await Promise.all([
        getActivePricingRates(),
        getActivePricingMaster(),
      ]);
      const v2Base: CostPriceInputsV2 = isV2Input(inputs)
        ? inputs
        : mapV1InputsToV2(inputs as CostPriceInputs);
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
      update.inputs = v2;
      update.calculated = fnc_price_cost_cal_ai(v2);
    }

    const scenario = await CostPriceScenarioModel.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();
    if (!scenario) return NextResponse.json({ error: "not_found" }, { status: 404 });
    invalidatePublicPricingCache();
    return NextResponse.json({ scenario });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (await isCostDataLocked()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  const { id } = await params;
  try {
    await connectDB();
    await CostPriceScenarioModel.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
