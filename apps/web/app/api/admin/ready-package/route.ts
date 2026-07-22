import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";
import { countReadyPackageUsage } from "@/lib/payment/readyPackageUsage";
import mongoose from "mongoose";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

type ItemInput = { scenarioId: string };

async function buildItems(itemInputs: ItemInput[]) {
  const ids = itemInputs.map((i) => i.scenarioId);

  // ตรวจสอบ ObjectId ทุกตัว
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      throw new Error(`invalid_scenario_id: ${id}`);
    }
  }

  // ตรวจ duplicate ภายใน request
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("duplicate_scenario_in_items");
  }

  const scenarios = await CostPriceScenarioModel.find({ _id: { $in: ids } }).lean();
  if (scenarios.length !== ids.length) {
    throw new Error("some_scenarios_not_found");
  }

  // เรียงตาม order ที่ client ส่งมา
  const scenarioMap = new Map(scenarios.map((s) => [String(s._id), s]));
  return ids.map((id) => {
    const s = scenarioMap.get(id)!;
    return {
      scenarioId: new mongoose.Types.ObjectId(id),
      plan: s.inputs.plan,
      packageName: s.inputs.packageName ?? "",
      bestPriceZudobot: s.inputs.bestPriceZudobot ?? 0,
      bestPricePartner: s.inputs.bestPricePartner ?? 0,
      vat7Zudobot: s.calculated?.vat7Zudobot ?? 0,
      wht3Zudobot: s.calculated?.wht3Zudobot ?? 0,
      vat7Partner: s.calculated?.vat7Partner ?? 0,
      wht3Partner: s.calculated?.wht3Partner ?? 0,
      // ต้นทุนจริง (AR) — ใช้คำนวณ % กำไรจาก Zudobot perspective
      totalCostAr: s.calculated?.totalCostAr ?? s.calculated?.monthlyTotalCost ?? 0,
      // spec snapshot for table display (no join needed)
      messageCount:           s.inputs.messageCount,
      inputTokensPerMessage:  s.inputs.inputTokensPerMessage,
      outputTokensPerMessage: s.inputs.outputTokensPerMessage,
      historyTokensPerMonth:  s.inputs.historyTokensPerMonth,
      storageMbPerMonth:      s.inputs.storageMbPerMonth,
      storageExpireDays:  s.inputs.storageExpireDays,
      trialDurationDays:  s.inputs.trialDurationDays,
    };
  });
}

/** เมื่อ isOnSale=true ให้ cascade ไปตั้งค่า scenario ที่เลือกทุกตัว */
async function cascadeOnSale(scenarioIds: string[]) {
  await CostPriceScenarioModel.updateMany(
    { _id: { $in: scenarioIds } },
    { $set: { isActive: true, isOnSale: true } },
  );
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await connectDB();
    const packages = await ReadyPackageModel.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    // Hydrate spec snapshot fields for items created before the spec snapshot was added.
    // Hydrate items missing spec snapshot or totalCostAr (created before snapshot was added)
    const needsHydration = packages.some((p) =>
      p.items.some((i) => i.messageCount == null || (i as Record<string, unknown>).totalCostAr == null),
    );

    if (needsHydration) {
      const idSet = new Set(packages.flatMap((p) => p.items.map((i) => String(i.scenarioId))));
      const allIds = Array.from(idSet);
      const scenarios = await CostPriceScenarioModel.find(
        { _id: { $in: allIds } },
        { "inputs.messageCount": 1, "inputs.inputTokensPerMessage": 1,
          "inputs.outputTokensPerMessage": 1, "inputs.historyTokensPerMonth": 1,
          "inputs.storageMbPerMonth": 1, "inputs.storageExpireDays": 1, "inputs.trialDurationDays": 1,
          "calculated.totalCostAr": 1, "calculated.monthlyTotalCost": 1 },
      ).lean();
      const sMap = new Map(scenarios.map((s) => [String(s._id), s]));

      for (const pkg of packages) {
        for (const item of pkg.items) {
          const row = item as Record<string, unknown>;
          const s = sMap.get(String(item.scenarioId));
          if (!s) continue;
          // Hydrate spec fields (inputs)
          if (item.messageCount == null) {
            row.messageCount            = s.inputs.messageCount;
            row.inputTokensPerMessage   = s.inputs.inputTokensPerMessage;
            row.outputTokensPerMessage  = s.inputs.outputTokensPerMessage;
            row.historyTokensPerMonth   = s.inputs.historyTokensPerMonth;
            row.storageMbPerMonth       = s.inputs.storageMbPerMonth;
            row.storageExpireDays       = s.inputs.storageExpireDays;
            row.trialDurationDays       = s.inputs.trialDurationDays;
          }
          // Hydrate totalCostAr (calculated)
          if (row.totalCostAr == null) {
            row.totalCostAr = s.calculated?.totalCostAr ?? s.calculated?.monthlyTotalCost ?? 0;
          }
        }
      }
    }

    // นับจำนวนร้านค้าที่ใช้แต่ละแพคเกจ → ใส่ field usedShops ให้ทุก doc
    const usage = await countReadyPackageUsage(packages.map((p) => String(p._id)));
    for (const pkg of packages) {
      (pkg as Record<string, unknown>).usedShops = usage[String(pkg._id)] ?? 0;
    }

    return NextResponse.json({ packages, total: packages.length });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const rawItems = body.items as ItemInput[] | undefined;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }

  try {
    await connectDB();
    const items = await buildItems(rawItems);
    const isOnSale = body.isOnSale !== false;

    const finalRetailPrice = body.finalRetailPrice != null && Number.isFinite(Number(body.finalRetailPrice))
      ? Number(body.finalRetailPrice) : undefined;
    const finalPartnerPrice = body.finalPartnerPrice != null && Number.isFinite(Number(body.finalPartnerPrice))
      ? Number(body.finalPartnerPrice) : undefined;

    const isTrial    = body.isTrial === true;
    const isLifetime = body.isLifetime === true;
    const trialDays  = isTrial && !isLifetime && body.trialDays != null
      ? Math.max(1, Math.min(365, Number(body.trialDays) || 14)) : undefined;

    const isPartnerAllowed = body.isPartnerAllowed !== false; // default true

    const maxShops = body.maxShops != null && Number.isFinite(Number(body.maxShops))
      ? Math.max(0, Math.floor(Number(body.maxShops))) : 0;

    const newShopsOnly = body.newShopsOnly === true;

    const doc = await ReadyPackageModel.create({
      name,
      items,
      finalRetailPrice,
      finalPartnerPrice,
      isActive: body.isActive !== false,
      isOnSale,
      isTrial,
      trialDays,
      isLifetime,
      isPartnerAllowed,
      maxShops,
      newShopsOnly,
      sortOrder: Number(body.sortOrder ?? 0),
    });

    if (isOnSale) {
      await cascadeOnSale(rawItems.map((i) => i.scenarioId));
    }

    // Invalidate public pricing cache so landing page reflects the new data
    invalidatePublicPricingCache();
    return NextResponse.json({ package: doc }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}