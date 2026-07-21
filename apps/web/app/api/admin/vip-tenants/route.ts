import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { VipTenantModel, calcVipPricing } from "@/lib/db/models/VipTenant";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { srv_expired_date_cal } from "@/lib/services/srv_expired_date_cal";
import { syncVipStatus } from "@/lib/services/srv_vip_sync";
import mongoose from "mongoose";
import { logSystemEvent } from "@/lib/logging/systemLogger";

/**
 * Auto-derive totalCostAr from a CostPriceScenario when the caller did not
 * provide an explicit cost value.
 *
 * If the VIP's baseAiQuota differs from the scenario's message count the cost
 * is scaled proportionally:
 *   vipCostAr = scenarioCostAr × (vipQuota / scenarioMessages)
 *
 * Returns null when the scenario is not found or has no valid cost.
 */
async function deriveVipCostFromScenario(
  scenarioId: string,
  vipQuota: number,
): Promise<number | null> {
  if (!mongoose.isValidObjectId(scenarioId)) return null;

  const scenario = await CostPriceScenarioModel.findById(scenarioId)
    .select({ "calculated.totalCostAr": 1, "inputs.messageCount": 1 })
    .lean();

  if (!scenario) return null;

  const scenarioCostAr = scenario.calculated?.totalCostAr ?? 0;
  if (scenarioCostAr <= 0) return null;

  const scenarioMessages = scenario.inputs?.messageCount ?? 0;
  if (scenarioMessages <= 0 || vipQuota <= 0) return scenarioCostAr;

  // Scale by quota ratio; round up to nearest integer (same ROUNDUP convention)
  const scaled = scenarioCostAr * (vipQuota / scenarioMessages);
  return Math.ceil(scaled);
}

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

// ── GET — list all VIP tenants ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

  try {
    await connectDB();
    const query = search
      ? { $or: [
          { email:      { $regex: search, $options: "i" } },
          { tenantName: { $regex: search, $options: "i" } },
          { label:      { $regex: search, $options: "i" } },
        ]}
      : {};
    const vips = await VipTenantModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ vips, total: vips.length });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ── POST — create VIP tenant ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }

  // Validate & calculate dates
  const startDate = body.startDate ? new Date(body.startDate as string) : new Date();
  const dateResult = body.durationDays
    ? srv_expired_date_cal({ startDate, durationDays: Number(body.durationDays) })
    : srv_expired_date_cal({ startDate, endDate: body.endDate as string });

  if (!dateResult.isValid) {
    return NextResponse.json({ error: dateResult.error ?? "date_invalid" }, { status: 400 });
  }

  // Auto-fill totalCostAr from referenced scenario when not explicitly provided
  let totalCostAr = body.totalCostAr != null ? Number(body.totalCostAr) : null;
  if (totalCostAr == null && body.referenceScenarioId) {
    const vipQuota = Number(body.baseAiQuota ?? 0);
    totalCostAr = await deriveVipCostFromScenario(
      String(body.referenceScenarioId),
      vipQuota,
    );
  }
  totalCostAr = totalCostAr ?? 0;

  const customVipPrice = Number(body.customVipPrice ?? 0);
  const derived        = calcVipPricing(totalCostAr, customVipPrice);

  try {
    await connectDB();
    const vip = await VipTenantModel.create({
      email,
      tenantId:               body.tenantId               ?? undefined,
      tenantName:             body.tenantName              ?? undefined,
      label:                  String(body.label ?? "").trim() || email,
      note:                   body.note                   ?? undefined,
      baseAiQuota:            Number(body.baseAiQuota      ?? 0),
      storageAddonQuota:      Number(body.storageAddonQuota ?? 0),
      expiredAddonQuota:      Number(body.expiredAddonQuota ?? 0),
      startDate:              dateResult.startDate,
      endDate:                dateResult.endDate,
      durationDays:           dateResult.durationDays,
      referenceScenarioId:    body.referenceScenarioId    ?? undefined,
      referenceScenarioLabel: body.referenceScenarioLabel ?? undefined,
      totalCostAr,
      customVipPrice,
      ...derived,
      autoRenew:              body.autoRenew === true,
      isActive:               body.isActive  !== false,
      createdBy:              token?.email ?? "unknown",
    });

    // Sync User.botState + isVip for this email
    await syncVipStatus(email).catch(() => {});
    await logSystemEvent({
      category: "admin_action", action: "create_vip", email, actorEmail: token?.email?.toLowerCase(),
      details: { targetType: "vip" },
    });

    return NextResponse.json({ vip }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
