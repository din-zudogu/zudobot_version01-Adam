import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import {
  createCheckoutSession,
  createCustomAmountCheckoutSession,
} from "@/lib/stripe/helpers";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";
import {
  mapSessionRoleToBuyerRole,
  resolveCheckoutPricingFromAuthority,
} from "@/lib/pricing/checkoutPricingAuthority";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import { countReadyPackageUsageOne, isNewShop } from "@/lib/payment/readyPackageUsage";
import { applyReadyPackageToTenant } from "@/lib/payment/applyReadyPackage";

// ── Body shapes ───────────────────────────────────────────────────────────────

interface LegacyBody {
  planId:        PlanId;
  memoryId:      MemoryAddonId;
  retentionId:   RetentionAddonId;
  paymentMethod: "card" | "promptpay";
}

interface ReadyPackageBody {
  readyPackageId:   string;
  addonScenarioIds?: string[];
  paymentMethod:    "card" | "promptpay";
}

interface ScenarioIdsBody {
  scenarioIds:   { aiBaseId?: string; storageId?: string; expiredId?: string };
  paymentMethod: "card" | "promptpay";
}

type CheckoutBody = LegacyBody | ReadyPackageBody | ScenarioIdsBody;

function isReadyPackageBody(b: CheckoutBody): b is ReadyPackageBody {
  return "readyPackageId" in b && typeof (b as ReadyPackageBody).readyPackageId === "string";
}

function isScenarioIdsBody(b: CheckoutBody): b is ScenarioIdsBody {
  return "scenarioIds" in b && typeof (b as ScenarioIdsBody).scenarioIds === "object";
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!["card", "promptpay"].includes(body.paymentMethod)) {
    return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });
  }

  try {
    await connectDB();
    const tenantId = token.sub;

    const user = await UserModel.findById(tenantId);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const sub        = await SubscriptionModel.findOne({ tenantId });
    const customerId = sub?.stripeCustomerId;

    // ── ReadyPackage flow ─────────────────────────────────────────────────────
    if (isReadyPackageBody(body)) {
      const pkg = await ReadyPackageModel.findById(body.readyPackageId).lean();
      if (!pkg || !pkg.isActive || !pkg.isOnSale) {
        return NextResponse.json({ error: "package_not_found" }, { status: 404 });
      }

      const packageId = (pkg._id as { toString(): string }).toString();

      // ร้านที่เคยรับแพคเกจนี้แล้ว (นับแบบใช้แล้วใช้เลย → ไม่สนใจ status) = ต่ออายุ ไม่กินสิทธิ์ใหม่
      const alreadyHolder = sub?.readyPackageId === packageId;

      // ── เงื่อนไข (optional): เฉพาะร้านค้าใหม่ (สมัครใหม่) เท่านั้น ──
      if (pkg.newShopsOnly && !alreadyHolder && !(await isNewShop(tenantId))) {
        return NextResponse.json(
          { error: "new_shops_only", detail: "แพคเกจนี้สำหรับร้านค้าใหม่ (สมัครใหม่) เท่านั้น" },
          { status: 403 },
        );
      }

      // ── โควต้าร้านค้า: บล็อกถ้าเต็ม (ยกเว้นร้านที่ถือแพคเกจนี้อยู่แล้ว = ต่ออายุ) ──
      if ((pkg.maxShops ?? 0) > 0 && !alreadyHolder) {
        const used = await countReadyPackageUsageOne(packageId);
        if (used >= (pkg.maxShops ?? 0)) {
          return NextResponse.json(
            { error: "package_full", detail: "แพคเกจนี้มีร้านค้าใช้ครบโควต้าแล้ว" },
            { status: 409 },
          );
        }
      }

      // SECURITY: prices always come from DB, never from client.
      // Re-price selected customize add-ons from CostPriceScenario (bestPriceZudobot).
      const addonIds = (body.addonScenarioIds ?? []).filter(
        (id) => typeof id === "string" && id.length > 0,
      );
      let addonTotal = 0;
      let addonResolvedIds: string[] = [];
      if (addonIds.length > 0) {
        const addons = await CostPriceScenarioModel.find(
          { _id: { $in: addonIds }, isActive: true, isOnSale: true },
          { "inputs.bestPriceZudobot": 1 },
        ).lean();
        for (const a of addons) {
          const inputs = a.inputs as unknown as Record<string, unknown>;
          addonTotal += (inputs?.bestPriceZudobot as number) ?? 0;
        }
        addonResolvedIds = addons.map((a) => (a._id as { toString(): string }).toString());
      }

      const amountThb = (pkg.finalRetailPrice ?? 0) + addonTotal;
      if (amountThb <= 0) {
        // Trial / free package — activate directly without Stripe. Also
        // overrides onboarding's generic 14-day trialEndsAt default with
        // this specific package's own terms (or clears it for lifetime).
        await applyReadyPackageToTenant(tenantId, pkg);
        return NextResponse.json({ url: "/dashboard/overview?trial=1" });
      }

      const url = await createCustomAmountCheckoutSession({
        tenantId,
        email:        user.email,
        name:         user.name ?? user.email,
        customerId,
        amountThb,
        productName:  pkg.name,
        description:  `${pkg.name} — รายเดือน (ยังไม่รวม VAT)`,
        nickname:     `ready_pkg_${packageId}`,
        paymentMethod: body.paymentMethod,
        metadata: {
          tenantId,
          readyPackageId: packageId,
          packageName:    pkg.name,
          addonScenarioIds: addonResolvedIds.join(","),
          amountThb:      String(amountThb),
        },
      });

      return NextResponse.json({ url });
    }

    // ── Customize Package flow (scenario IDs → look up prices in DB) ────────────
    if (isScenarioIdsBody(body)) {
      const { aiBaseId, storageId, expiredId } = body.scenarioIds;
      const ids = [aiBaseId, storageId, expiredId].filter(Boolean) as string[];
      if (ids.length === 0) {
        return NextResponse.json({ error: "no_scenarios_selected" }, { status: 400 });
      }

      // SECURITY: fetch prices from DB — never trust client-sent amounts
      const scenarios = await CostPriceScenarioModel.find(
        { _id: { $in: ids }, isActive: true },
        { label: 1, "inputs.bestPriceZudobot": 1, "inputs.calculationType": 1 },
      ).lean();

      if (scenarios.length === 0) {
        return NextResponse.json({ error: "no_valid_scenarios" }, { status: 404 });
      }

      let amountThb = 0;
      const parts: string[] = [];
      for (const s of scenarios) {
        const inputs = s.inputs as unknown as Record<string, unknown>;
        const price  = (inputs?.bestPriceZudobot as number) ?? 0;
        amountThb += price;
        parts.push(s.label);
      }

      if (amountThb <= 0) {
        return NextResponse.json({ error: "zero_amount" }, { status: 400 });
      }

      const description = parts.join(" + ");
      const nickname    = `custom_${ids.sort().join("_")}`.slice(0, 250);

      const url = await createCustomAmountCheckoutSession({
        tenantId,
        email:        user.email,
        name:         user.name ?? user.email,
        customerId,
        amountThb,
        productName:  "Zudobot Customize Package",
        description:  `${description} (รายเดือน, ยังไม่รวม VAT)`,
        nickname,
        paymentMethod: body.paymentMethod,
        metadata: {
          tenantId,
          packageType: "customize",
          scenarioIds: ids.join(","),
          amountThb:   String(amountThb),
        },
      });

      return NextResponse.json({ url });
    }

    // ── Legacy flow (planId + memoryId + retentionId) ─────────────────────────
    const { planId, memoryId, retentionId, paymentMethod } = body as LegacyBody;

    const validPlans: PlanId[]               = ["starter", "pro", "master"];
    const validMemory: MemoryAddonId[]       = ["free", "small", "medium", "large"];
    const validRetention: RetentionAddonId[] = ["standard", "1month", "3months", "6months", "lifetime"];

    if (
      !validPlans.includes(planId) ||
      !validMemory.includes(memoryId) ||
      !validRetention.includes(retentionId)
    ) {
      return NextResponse.json({ error: "invalid_plan_combo" }, { status: 400 });
    }

    const buyerRole = mapSessionRoleToBuyerRole(token.role);
    const authority = await resolveCheckoutPricingFromAuthority({ buyerRole, planId, memoryId, retentionId });
    if ("error" in authority) {
      console.warn("[stripe/checkout] pricing authority fallback:", authority.error);
    } else {
      console.info("[stripe/checkout] authority retail THB:", authority.customerChargeThb);
    }

    const checkoutUrl = await createCheckoutSession({
      tenantId, email: user.email, name: user.name, customerId,
      planId, memoryId, retentionId, paymentMethod,
    });

    return NextResponse.json({
      url: checkoutUrl,
      ...(!("error" in authority) && {
        pricingSource:     authority.lines[0]?.source,
        expectedRetailThb: authority.customerChargeThb,
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stripe_error";
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: "stripe_error", detail: msg }, { status: 500 });
  }
}
