import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";
import mongoose from "mongoose";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

type RouteContext = { params: Promise<{ id: string }> };
type ItemInput = { scenarioId: string };

async function buildItems(itemInputs: ItemInput[]) {
  const ids = itemInputs.map((i) => i.scenarioId);
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) throw new Error(`invalid_scenario_id: ${id}`);
  }
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error("duplicate_scenario_in_items");

  const scenarios = await CostPriceScenarioModel.find({ _id: { $in: ids } }).lean();
  if (scenarios.length !== ids.length) throw new Error("some_scenarios_not_found");

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
    };
  });
}

async function cascadeOnSale(scenarioIds: string[]) {
  await CostPriceScenarioModel.updateMany(
    { _id: { $in: scenarioIds } },
    { $set: { isActive: true, isOnSale: true } },
  );
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    const update: Record<string, unknown> = {};
    if (body.name != null) update.name = String(body.name).trim();
    if (body.sortOrder != null) update.sortOrder = Number(body.sortOrder);
    if (body.isActive != null) update.isActive = body.isActive === true;
    if (body.finalRetailPrice != null) {
      update.finalRetailPrice = Number.isFinite(Number(body.finalRetailPrice))
        ? Number(body.finalRetailPrice) : undefined;
    }
    if (body.finalPartnerPrice != null) {
      update.finalPartnerPrice = Number.isFinite(Number(body.finalPartnerPrice))
        ? Number(body.finalPartnerPrice) : undefined;
    }
    if (body.isTrial != null) {
      update.isTrial = body.isTrial === true;
      update.trialDays = body.isTrial === true && body.trialDays != null
        ? Math.max(1, Math.min(365, Number(body.trialDays) || 14)) : undefined;
    }
    if (body.isPartnerAllowed != null) {
      update.isPartnerAllowed = body.isPartnerAllowed !== false;
    }
    if (body.maxShops != null) {
      update.maxShops = Number.isFinite(Number(body.maxShops))
        ? Math.max(0, Math.floor(Number(body.maxShops))) : 0;
    }
    if (body.newShopsOnly != null) {
      update.newShopsOnly = body.newShopsOnly === true;
    }

    const rawItems = body.items as ItemInput[] | undefined;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      update.items = await buildItems(rawItems);
    }

    const isOnSale = body.isOnSale != null ? body.isOnSale === true : undefined;
    if (isOnSale != null) update.isOnSale = isOnSale;

    const doc = await ReadyPackageModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // cascade เฉพาะเมื่อตั้งเป็น isOnSale=true
    if (isOnSale === true && Array.isArray(rawItems) && rawItems.length > 0) {
      await cascadeOnSale(rawItems.map((i) => i.scenarioId));
    } else if (isOnSale === true) {
      // ใช้ items ที่บันทึกอยู่แล้ว
      const existing = await ReadyPackageModel.findById(id).lean();
      if (existing?.items?.length) {
        await cascadeOnSale(existing.items.map((i) => String(i.scenarioId)));
      }
    }

    invalidatePublicPricingCache();
    return NextResponse.json({ package: doc });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await connectDB();
    await ReadyPackageModel.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
