import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel, generateUniquePlanId } from "@/lib/db/models/CostPriceScenario";
import { buildSeedDocuments } from "@/lib/pricing/costPriceSeedData";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

/** POST — import default rows from Excel baseline (super_admin) */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let replace = false;
  try {
    const body = await req.json().catch(() => ({}));
    replace = Boolean((body as { replace?: boolean }).replace);
  } catch {
    /* empty body ok */
  }

  try {
    await connectDB();
    if (replace) {
      await CostPriceScenarioModel.deleteMany({});
    }

    const existing = await CostPriceScenarioModel.countDocuments();
    if (existing > 0 && !replace) {
      return NextResponse.json(
        { error: "already_seeded", count: existing },
        { status: 409 },
      );
    }

    const seeds = buildSeedDocuments();
    const idByLabel = new Map<string, string>();

    for (const row of seeds) {
      if (row.referenceLabel) continue;
      const created = await CostPriceScenarioModel.create({
        plan_id: await generateUniquePlanId(),
        label: row.label,
        sortOrder: row.sortOrder,
        inputs: row.inputs,
        calculated: row.calculated,
        isActive: true,
        isOnSale: true,
      });
      idByLabel.set(row.label, String(created._id));
    }

    for (const row of seeds) {
      if (!row.referenceLabel) continue;
      const refId = idByLabel.get(row.referenceLabel);
      const refDoc = refId
        ? await CostPriceScenarioModel.findById(refId).lean()
        : null;
      const referenceUnitCostAq =
        row.inputs.referenceUnitCostAq ??
        refDoc?.calculated?.monthlyTotalCost;

      const inputs = {
        ...row.inputs,
        referenceUnitCostAq,
        pricingMode: "reference_multiple" as const,
      };

      const { fnc_price_cost_cal_ai } = await import("@/lib/pricing/fnc_price_cost_cal_ai");
      const calculated = fnc_price_cost_cal_ai(inputs);

      await CostPriceScenarioModel.create({
        plan_id: await generateUniquePlanId(),
        label: row.label,
        sortOrder: row.sortOrder,
        inputs,
        calculated,
        referenceScenarioId: refId,
        isActive: true,
        isOnSale: true,
      });
    }

    const total = await CostPriceScenarioModel.countDocuments();
    return NextResponse.json({ ok: true, total });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
