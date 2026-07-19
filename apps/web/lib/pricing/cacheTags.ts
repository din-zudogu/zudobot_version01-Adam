import { revalidateTag } from "next/cache";

/** Next.js on-demand revalidation tags for public pricing surfaces. */
export const PUBLIC_PRICING_TAG = "public-pricing";
export const PARTNER_BENEFITS_TAG = "partner-benefits";

export function invalidatePublicPricingCache(): void {
  revalidateTag(PUBLIC_PRICING_TAG);
  revalidateTag(PARTNER_BENEFITS_TAG);
}
