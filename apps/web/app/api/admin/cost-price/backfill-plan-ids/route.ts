import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel, generateUniquePlanId } from "@/lib/db/models/CostPriceScenario";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

/** POST — assign plan_id to all existing docs that don't have one (super_admin only, idempotent) */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();

  const docs = await CostPriceScenarioModel.find(
    { plan_id: { $exists: false } },
    { _id: 1 },
  ).lean();

  if (docs.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "all plans already have plan_id" });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    try {
      const plan_id = await generateUniquePlanId();
      await CostPriceScenarioModel.updateOne({ _id: doc._id }, { $set: { plan_id } });
      updated++;
    } catch (err) {
      errors.push(String(doc._id));
      console.error("[backfill-plan-ids] failed for", doc._id, err);
    }
  }

  return NextResponse.json({ ok: errors.length === 0, updated, errors });
}
