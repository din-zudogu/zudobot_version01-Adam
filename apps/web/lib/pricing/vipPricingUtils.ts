/**
 * VIP Tenant pricing utilities — pure functions, no server-side dependencies.
 * Safe to import from both client components and server-side API routes.
 */

export interface VipPricingResult {
  profitAmount: number;
  profitPct:    number;
  vat7Amount:   number;
  wht3Amount:   number;
}

export function calcVipPricing(
  totalCostAr:   number,
  customVipPrice: number,
): VipPricingResult {
  const profitAmount = customVipPrice - totalCostAr;
  const profitPct    = customVipPrice > 0 ? (profitAmount / customVipPrice) * 100 : 0;
  const vat7Amount   = customVipPrice * 0.07;
  const wht3Amount   = totalCostAr    * 0.03;
  return { profitAmount, profitPct, vat7Amount, wht3Amount };
}
