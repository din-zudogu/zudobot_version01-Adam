import {
  getCachedPublicPricing,
  type PublicPricingSnapshot,
} from "@/lib/pricing/buildPublicPricing";
import { PARTNER_BENEFITS_TAG, PUBLIC_PRICING_TAG } from "@/lib/pricing/cacheTags";

/**
 * Server-side public pricing read — tied to revalidateTag cache keys from pricingSyncService.
 */
export async function getPublicPricingData(): Promise<PublicPricingSnapshot> {
  try {
    return await getCachedPublicPricing();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[public-pricing] fallback snapshot due to data source error:", message);
    return {
      basePlans: [],
      quotaAddons: [],
      retentionAddons: [],
      partnerPlans: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

/** Tags for fetch()-based consumers (ISR / external callers). */
export const PUBLIC_PRICING_FETCH_TAGS = [PUBLIC_PRICING_TAG, PARTNER_BENEFITS_TAG] as const;

/**
 * Optional HTTP fetch for edge/external runtimes — uses same cache tags as admin sync.
 */
export async function fetchPublicPricingViaApi(
  baseUrl?: string
): Promise<PublicPricingSnapshot> {
  const origin =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${origin}/api/public/packages`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    next: { tags: [...PUBLIC_PRICING_FETCH_TAGS] },
  });

  if (!res.ok) {
    return {
      basePlans: [],
      quotaAddons: [],
      retentionAddons: [],
      partnerPlans: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return res.json() as Promise<PublicPricingSnapshot>;
}
