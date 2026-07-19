/**
 * GET /api/checkout/validate?pkg=<readyPackageId>
 *
 * Validates and returns ReadyPackage + available add-ons for checkout.
 * Security: isActive=true AND isOnSale=true enforced server-side.
 * If the package is no longer available, returns 404 immediately.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: Record<string, number> = {
  "AI Base": 0, "Storage Add-on": 1, "Expired Add-on": 2, "Trial": 3,
};

function planCategory(plan: string): string {
  const p = plan.toLowerCase();
  if (p.includes("storage")) return "Storage Add-on";
  if (p.includes("expired")) return "Expired Add-on";
  if (p.includes("trial"))   return "Trial";
  if (p.includes("ai base")) return "AI Base";
  return "อื่นๆ";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pkgId = searchParams.get("pkg");

  if (!pkgId || !mongoose.isValidObjectId(pkgId)) {
    return NextResponse.json({ error: "invalid_pkg_id" }, { status: 400 });
  }

  try {
    await connectDB();

    // ── 1. Validate ReadyPackage ────────────────────────────────────
    const pkg = await ReadyPackageModel.findById(pkgId).lean();

    if (!pkg) {
      return NextResponse.json({ error: "package_not_found" }, { status: 404 });
    }
    if (!pkg.isActive || !pkg.isOnSale) {
      return NextResponse.json(
        { error: "package_unavailable", reason: !pkg.isActive ? "inactive" : "not_on_sale" },
        { status: 410 }, // 410 Gone — was available, now not
      );
    }

    // ── 2. Hydrate spec snapshot if fields are missing (legacy docs) ─
    if (pkg.items.some((i) => i.messageCount == null)) {
      const idSet = pkg.items.map((i) => String(i.scenarioId));
      const srcScenarios = await CostPriceScenarioModel.find(
        { _id: { $in: idSet } },
        {
          "inputs.messageCount": 1, "inputs.inputTokensPerMessage": 1,
          "inputs.outputTokensPerMessage": 1, "inputs.historyTokensPerMonth": 1,
          "inputs.storageMbPerMonth": 1,
          "inputs.storageExpireDays": 1, "inputs.trialDurationDays": 1,
        },
      ).lean();
      const sMap = new Map(srcScenarios.map((s) => [String(s._id), s]));
      for (const item of pkg.items) {
        if (item.messageCount != null) continue;
        const s = sMap.get(String(item.scenarioId));
        if (!s) continue;
        const row = item as Record<string, unknown>;
        row.messageCount            = s.inputs.messageCount;
        row.inputTokensPerMessage   = s.inputs.inputTokensPerMessage;
        row.outputTokensPerMessage  = s.inputs.outputTokensPerMessage;
        row.historyTokensPerMonth   = s.inputs.historyTokensPerMonth;
        row.storageMbPerMonth       = s.inputs.storageMbPerMonth;
        row.storageExpireDays       = s.inputs.storageExpireDays;
        row.trialDurationDays       = s.inputs.trialDurationDays;
      }
    }

    // ── 3. Build ReadyPackage display data ─────────────────────────
    const packageData = {
      _id:               pkg._id.toString(),
      name:              pkg.name,
      isTrial:           pkg.isTrial ?? false,
      trialDays:         pkg.trialDays,
      finalRetailPrice:  pkg.finalRetailPrice ?? 0,
      finalPartnerPrice: pkg.finalPartnerPrice ?? 0,
      isPartnerAllowed:  pkg.isPartnerAllowed ?? true,
      items: pkg.items.map((item) => ({
        plan:               item.plan,
        packageName:        item.packageName,
        messageCount:           item.messageCount,
        inputTokensPerMessage:  (item as Record<string, unknown>).inputTokensPerMessage,
        outputTokensPerMessage: (item as Record<string, unknown>).outputTokensPerMessage,
        historyTokensPerMonth:  (item as Record<string, unknown>).historyTokensPerMonth,
        storageMbPerMonth:      (item as Record<string, unknown>).storageMbPerMonth,
        storageExpireDays:  item.storageExpireDays,
        trialDurationDays:  item.trialDurationDays,
      })),
    };

    // ── 4. Available add-ons (isActive=true AND isOnSale=true) ──────
    const scenarios = await CostPriceScenarioModel.find({
      isActive: true,
      isOnSale: true,
    })
      .sort({ sortOrder: 1, updatedAt: -1 })
      .lean();

    const addonPlans = scenarios
      .filter((s) => (s.inputs?.bestPriceZudobot ?? 0) > 0)
      .sort((a, b) => {
        const catA = CATEGORY_ORDER[planCategory(a.inputs?.plan ?? "")] ?? 9;
        const catB = CATEGORY_ORDER[planCategory(b.inputs?.plan ?? "")] ?? 9;
        if (catA !== catB) return catA - catB;
        return (a.inputs?.bestPriceZudobot ?? 0) - (b.inputs?.bestPriceZudobot ?? 0);
      })
      .map((s) => ({
        _id:              s._id.toString(),
        label:            s.label,
        plan:             s.inputs?.plan ?? "",
        packageName:      s.inputs?.packageName ?? "",
        baseAddon:        s.inputs?.baseAddon ?? "Base",
        category:         planCategory(s.inputs?.plan ?? ""),
        aiBaseMonths:     s.inputs?.aiBaseMonths ?? 1,
        messageCount:     s.inputs?.messageCount ?? 0,
        storageExpireDays: s.inputs?.storageExpireDays,
        bestPriceZudobot: s.inputs?.bestPriceZudobot ?? 0,
        bestPricePartner: s.inputs?.bestPricePartner ?? 0,
        isBestPriceHighlight: s.isBestPriceHighlight ?? false,
        packageDescription: s.packageDescription ?? "",
      }));

    return NextResponse.json({
      ok:          true,
      package:     packageData,
      addonPlans,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
