import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { VipTenantModel, calcVipPricing } from "@/lib/db/models/VipTenant";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { srv_expired_date_cal } from "@/lib/services/srv_expired_date_cal";
import { syncVipStatus } from "@/lib/services/srv_vip_sync";
import mongoose from "mongoose";
import { logSystemEvent } from "@/lib/logging/systemLogger";

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
  return Math.ceil(scenarioCostAr * (vipQuota / scenarioMessages));
}

type RouteContext = { params: Promise<{ id: string }> };

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

// ── PUT — update VIP tenant ──────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const update: Record<string, unknown> = {};

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email.includes("@")) return NextResponse.json({ error: "email_invalid" }, { status: 400 });
    update.email = email;
  }
  if (body.tenantId      !== undefined) update.tenantId      = body.tenantId;
  if (body.tenantName    !== undefined) update.tenantName    = body.tenantName;
  if (body.label         !== undefined) update.label         = String(body.label).trim();
  if (body.note          !== undefined) update.note          = body.note || undefined;
  if (body.baseAiQuota   !== undefined) update.baseAiQuota   = Number(body.baseAiQuota);
  if (body.storageAddonQuota !== undefined) update.storageAddonQuota = Number(body.storageAddonQuota);
  if (body.expiredAddonQuota !== undefined) update.expiredAddonQuota = Number(body.expiredAddonQuota);
  if (body.autoRenew     !== undefined) update.autoRenew     = body.autoRenew === true;
  if (body.isActive      !== undefined) update.isActive      = body.isActive  !== false;
  if (body.referenceScenarioId    !== undefined) update.referenceScenarioId    = body.referenceScenarioId    ?? undefined;
  if (body.referenceScenarioLabel !== undefined) update.referenceScenarioLabel = body.referenceScenarioLabel ?? undefined;

  // Recalculate dates if provided
  if (body.startDate || body.endDate || body.durationDays) {
    const startDate = body.startDate ? new Date(body.startDate as string) : undefined;
    const existing  = startDate ? null : await VipTenantModel.findById(id).select("startDate").lean();
    const baseStart = startDate ?? (existing ? new Date((existing as { startDate: Date }).startDate) : new Date());
    const dateResult = body.durationDays
      ? srv_expired_date_cal({ startDate: baseStart, durationDays: Number(body.durationDays) })
      : srv_expired_date_cal({ startDate: baseStart, endDate: body.endDate as string });
    if (!dateResult.isValid) return NextResponse.json({ error: dateResult.error }, { status: 400 });
    update.startDate    = dateResult.startDate;
    update.endDate      = dateResult.endDate;
    update.durationDays = dateResult.durationDays;
  }

  // Recalculate pricing when cost, price, scenario, or quota changes
  const needsPriceRecalc =
    body.totalCostAr       !== undefined ||
    body.customVipPrice    !== undefined ||
    body.referenceScenarioId !== undefined ||
    body.baseAiQuota       !== undefined;

  if (needsPriceRecalc) {
    const existing = await VipTenantModel.findById(id)
      .select("totalCostAr customVipPrice referenceScenarioId baseAiQuota")
      .lean() as {
        totalCostAr: number;
        customVipPrice: number;
        referenceScenarioId?: mongoose.Types.ObjectId;
        baseAiQuota: number;
      } | null;

    // Determine the effective cost:
    // 1. Explicit body value takes highest precedence
    // 2. If scenario changed (or quota changed) and no explicit cost → auto-derive
    // 3. Fall back to existing stored cost
    let cost: number;
    if (body.totalCostAr !== undefined) {
      cost = Number(body.totalCostAr);
    } else {
      const scenarioIdForCalc = body.referenceScenarioId != null
        ? String(body.referenceScenarioId)
        : (existing?.referenceScenarioId ? String(existing.referenceScenarioId) : null);
      const quotaForCalc = body.baseAiQuota !== undefined
        ? Number(body.baseAiQuota)
        : (existing?.baseAiQuota ?? 0);

      if (scenarioIdForCalc && (body.referenceScenarioId !== undefined || body.baseAiQuota !== undefined)) {
        const derived = await deriveVipCostFromScenario(scenarioIdForCalc, quotaForCalc);
        cost = derived ?? (existing?.totalCostAr ?? 0);
      } else {
        cost = existing?.totalCostAr ?? 0;
      }
    }

    const price = body.customVipPrice !== undefined
      ? Number(body.customVipPrice)
      : (existing?.customVipPrice ?? 0);

    update.totalCostAr    = cost;
    update.customVipPrice = price;
    Object.assign(update, calcVipPricing(cost, price));
  }

  try {
    await connectDB();

    // Capture old email before update (needed if email changes)
    let oldEmail: string | null = null;
    if (update.email) {
      const prev = await VipTenantModel.findById(id).select("email").lean() as { email: string } | null;
      oldEmail = prev?.email ?? null;
    }

    const vip = await VipTenantModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!vip) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Sync VIP status — handle email change case
    const newEmail = (vip as { email: string }).email;
    await syncVipStatus(newEmail).catch(() => {});
    if (oldEmail && oldEmail !== newEmail) {
      await syncVipStatus(oldEmail).catch(() => {});
    }
    await logSystemEvent({
      category: "admin_action", action: "update_vip", email: newEmail, actorEmail: token?.email?.toLowerCase(),
      details: { targetType: "vip" },
    });

    return NextResponse.json({ vip });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await connectDB();

    // Get email before deleting so we can re-sync the user's VIP state
    const vip = await VipTenantModel.findById(id).select("email").lean() as { email: string } | null;
    await VipTenantModel.findByIdAndDelete(id);

    if (vip?.email) {
      await syncVipStatus(vip.email).catch(() => {});
    }
    await logSystemEvent({
      category: "admin_action", action: "delete_vip", email: vip?.email, actorEmail: token?.email?.toLowerCase(),
      details: { targetType: "vip" },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
