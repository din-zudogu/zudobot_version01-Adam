import "server-only";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { MasterPlanConfigModel } from "@/lib/db/models/MasterPlanConfig";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { invalidatePublicPricingCache } from "@/lib/pricing/cacheTags";

// Also invalidates /api/public/pricing cache (same tags)

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Strict schema — blocks malicious / malformed admin payloads. */
export const PackageUpdateSchema = z.object({
  id: z.string().regex(OBJECT_ID_RE, "Invalid Package ID Format"),
  name: z.string().min(1, "Package name cannot be empty"),
  retailPrice: z
    .number()
    .refine((n: number) => n >= 0 || n === -1, "Retail price must be >= 0 or -1 (custom)"),
  aiBasePrice: z
    .number()
    .refine((n: number) => n >= 0 || n === -1, "AI Base price must be >= 0 or -1 (custom)"),
  addOnPrice: z
    .number()
    .refine((n: number) => n >= 0 || n === -1, "Add-on price must be >= 0 or -1 (custom)"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("THB"),
  updatedAt: z.string().datetime(),
});

export type PackageUpdateInput = z.infer<typeof PackageUpdateSchema>;

export type SyncResult = { success: boolean; message: string };

const PRICING_BODY_KEYS = new Set([
  "retail_price",
  "retailPrice",
  "partner_cost",
  "addOnPrice",
  "zudobot_internal_cost",
  "aiBasePrice",
  "priceThb",
  "partnerCost",
  "systemCostThb",
  "wholesalePriceThb",
  "label_th",
  "label",
  "name",
]);

export function stripPricingFieldsFromUpdate(
  body: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!PRICING_BODY_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function bodyHasPricingFields(body: Record<string, unknown>): boolean {
  return Object.keys(body).some((k) => PRICING_BODY_KEYS.has(k));
}

/** Map admin API body (native or alias fields) → sync payload. */
export function buildSyncPayloadFromBody(
  mongoId: string,
  body: Record<string, unknown>
): unknown {
  const name =
    typeof body.label_th === "string"
      ? body.label_th
      : typeof body.label === "string"
        ? body.label
        : typeof body.name === "string"
          ? body.name
          : "";

  return {
    id: mongoId,
    name,
    retailPrice: Number(body.retail_price ?? body.retailPrice ?? body.priceThb ?? 0),
    aiBasePrice: Number(
      body.zudobot_internal_cost ?? body.aiBasePrice ?? body.systemCostThb ?? 0
    ),
    addOnPrice: Number(body.partner_cost ?? body.addOnPrice ?? body.partnerCost ?? 0),
    currency: "THB",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Core sync — MasterPlanConfig (Single Source of Truth for public pricing).
 * Call from Admin Master Plan PUT and bootstrap init.
 */
export async function syncPackagePrices(
  rawPayload: unknown,
  opts?: { skipCache?: boolean }
): Promise<SyncResult> {
  try {
    const validated = PackageUpdateSchema.parse(rawPayload);

    if (validated.currency !== "THB") {
      return { success: false, message: "Only THB currency is supported." };
    }

    await connectDB();

    const updateResult = await MasterPlanConfigModel.findByIdAndUpdate(
      validated.id,
      {
        $set: {
          label_th: validated.name,
          retail_price: validated.retailPrice,
          zudobot_internal_cost: validated.aiBasePrice,
          partner_cost: validated.addOnPrice,
          updatedAt: new Date(validated.updatedAt),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updateResult) {
      throw new Error("Failed to write to database during synchronization");
    }

    if (!opts?.skipCache) {
      invalidatePublicPricingCache();
    }

    console.log(
      `[Sync Success] MasterPlan ${validated.id} synchronized across all channels.`
    );
    return {
      success: true,
      message: "Synchronization complete and cache invalidated.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[Sync Security Alert] Invalid schema layout detected:", error.issues);
      return { success: false, message: "Data validation integrity failure." };
    }
    console.error("[Sync System Error] Failed to execute automated sync:", error);
    return { success: false, message: "Internal server synchronization failure." };
  }
}

/**
 * Legacy PackageConfig sync (Billing/Stripe catalog) + cache purge for public pages.
 */
export async function syncLegacyPackagePrices(rawPayload: unknown): Promise<SyncResult> {
  try {
    const validated = PackageUpdateSchema.parse(rawPayload);

    await connectDB();

    const updateResult = await PackageConfigModel.findByIdAndUpdate(
      validated.id,
      {
        $set: {
          label: validated.name,
          priceThb: validated.retailPrice,
          systemCostThb: validated.aiBasePrice,
          partnerCost: validated.addOnPrice,
          updatedAt: new Date(validated.updatedAt),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updateResult) {
      throw new Error("Failed to write legacy PackageConfig during synchronization");
    }

    invalidatePublicPricingCache();

    console.log(`[Sync Success] Legacy Package ${validated.id} synchronized.`);
    return {
      success: true,
      message: "Legacy package synchronized and cache invalidated.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[Sync Security Alert] Legacy invalid schema:", error.issues);
      return { success: false, message: "Data validation integrity failure." };
    }
    console.error("[Sync System Error] Legacy sync failed:", error);
    return { success: false, message: "Internal server synchronization failure." };
  }
}

/** Run sync from admin PUT body without exposing derived financial fields to the client. */
export async function triggerMasterPlanSyncFromAdminBody(
  mongoId: string,
  body: Record<string, unknown>
): Promise<SyncResult> {
  const hasPricing = bodyHasPricingFields(body);

  if (!hasPricing) {
    invalidatePublicPricingCache();
    return { success: true, message: "Cache invalidated (non-pricing update)." };
  }

  return syncPackagePrices(buildSyncPayloadFromBody(mongoId, body));
}

export async function triggerLegacyPackageSyncFromAdminBody(
  mongoId: string,
  body: Record<string, unknown>
): Promise<SyncResult> {
  const hasPricing = bodyHasPricingFields(body);

  if (!hasPricing) {
    invalidatePublicPricingCache();
    return { success: true, message: "Cache invalidated (non-pricing update)." };
  }

  return syncLegacyPackagePrices(buildSyncPayloadFromBody(mongoId, body));
}

/**
 * Auto-run on deployment boot — validates all active master plans and clears stale cache.
 */
export async function initializeDeploymentSync(): Promise<void> {
  console.log("[Deploy Initialization] Executing first-time pricing synchronization query...");
  try {
    await connectDB();
    const currentPackages = await MasterPlanConfigModel.find({ is_active: true }).lean();

    for (const pkg of currentPackages) {
      if (!mongoose.Types.ObjectId.isValid(String(pkg._id))) continue;

      const result = await syncPackagePrices(
        {
          id: String(pkg._id),
          name: pkg.label_th,
          retailPrice: pkg.retail_price,
          aiBasePrice: pkg.zudobot_internal_cost,
          addOnPrice: pkg.partner_cost,
          currency: "THB",
          updatedAt: new Date().toISOString(),
        },
        { skipCache: true }
      );

      if (!result.success) {
        console.warn(`[Deploy Initialization] Skipped ${pkg.plan_code}: ${result.message}`);
      }
    }

    invalidatePublicPricingCache();
    console.log(
      "[Deploy Initialization] First-time data synchronization successfully established."
    );
  } catch (bootError) {
    console.error("[Deploy Initialization Error] Automated bootstrap sync failed:", bootError);
  }
}
