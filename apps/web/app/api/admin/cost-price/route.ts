import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel, generateUniquePlanId } from "@/lib/db/models/CostPriceScenario";
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

async function calcWithDbRates(rawInputs: CostPriceInputsV2 | CostPriceInputs) {
  const [rateConfig, master] = await Promise.all([
    getActivePricingRates(),
    getActivePricingMaster(),
  ]);

  const v2Base: CostPriceInputsV2 = isV2Input(rawInputs)
    ? rawInputs
    : mapV1InputsToV2(rawInputs as CostPriceInputs);

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

  return { calculated: fnc_price_cost_cal_ai(v2), v2Inputs: v2 };
}

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

function sanitizeDescription(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v).trim().slice(0, 1000) || undefined;
}

async function buildScenario(body: Record<string, unknown>) {
  const inputs = body.inputs as CostPriceInputsV2 | CostPriceInputs;
  if (!inputs?.plan || !inputs?.packageName) {
    throw new Error("inputs.plan and inputs.packageName are required");
  }
  const { calculated, v2Inputs } = await calcWithDbRates(inputs);
  return {
    plan_id: await generateUniquePlanId(),
    label: String(body.label ?? `${inputs.plan} — ${inputs.packageName}`),
    packageDescription: sanitizeDescription(body.packageDescription),
    shareToKnowledgeBase: body.shareToKnowledgeBase === true,
    isBestPriceHighlight: body.isBestPriceHighlight === true,
    isTrialPackage: body.isTrialPackage === true,
    isOnSale: body.isOnSale !== false,
    isPartnerAllowed: body.isPartnerAllowed !== false,
    inputs: v2Inputs,
    calculated,
    referenceScenarioId: body.referenceScenarioId,
    sortOrder: Number(body.sortOrder ?? 0),
    isActive: body.isActive !== false,
  };
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Honeypot: return fake data when system is locked
  if (await isCostDataLocked()) {
    const scenarios = generateHoneypotScenarios();
    return NextResponse.json({ scenarios, total: scenarios.length });
  }
  try {
    await connectDB();
    const scenarios = await CostPriceScenarioModel.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({ scenarios, total: scenarios.length });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await buildScenario(body);
    const scenario = await CostPriceScenarioModel.create(doc);
    invalidatePublicPricingCache();
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
