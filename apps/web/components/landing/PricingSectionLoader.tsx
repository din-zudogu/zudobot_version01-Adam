import { getPublicPricingData } from "@/lib/data/getPublicPricing";
import { PricingSection } from "@/components/landing/PricingSection";

/** Server wrapper — loads SSOT pricing with cache tags. */
export async function PricingSectionLoader() {
  const pricing = await getPublicPricingData();
  return <PricingSection pricing={pricing} />;
}
