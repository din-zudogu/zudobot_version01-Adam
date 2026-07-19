"use client";

import { useMemo } from "react";
import { usePricingSync } from "@/hooks/usePricingSync";
import type { PublicPricingSnapshot } from "@/lib/pricing/buildPublicPricing";
import { mapPublicPackagesToSnapshot } from "@/lib/pricing/mapPublicPackagesToSnapshot";
import { STATIC_PRICING_FALLBACK } from "@/lib/pricing/staticPricingFallback";

const PROJECTION_CLIENTS = [3, 5, 2] as const;

type Props = {
  serverFallback?: PublicPricingSnapshot;
};

export function PartnerBenefitPricingDynamic({ serverFallback }: Props) {
  const { packages, quotaAddons, retentionAddons, isLoading, syncedFromApi, error } =
    usePricingSync({ cycle: "1m" });

  const snapshot = useMemo((): PublicPricingSnapshot => {
    if (syncedFromApi && packages.length > 0) {
      return mapPublicPackagesToSnapshot(packages, "1m");
    }
    if (serverFallback && serverFallback.partnerPlans.length > 0) {
      return serverFallback;
    }
    return STATIC_PRICING_FALLBACK;
  }, [syncedFromApi, packages, serverFallback]);

  const planCards = snapshot.partnerPlans.map((p, i) => ({
    key: p.id || String(i),
    name: p.name,
    msgs: p.msgs,
    retail: p.retail,
    wholesale: p.wholesale,
    profit: p.profit,
    pct: p.pct,
    popular: p.popular,
    retailNum: p.retailNum,
    profitNum: p.profitNum,
  }));

  const projectionRows = snapshot.partnerPlans.slice(0, 3).map((p, i) => ({
    plan: p.name,
    clients: PROJECTION_CLIENTS[i] ?? 1,
    profitPerClient: p.profitNum,
  }));

  const totalMonthlyProfit = projectionRows.reduce(
    (s, r) => s + r.profitPerClient * r.clients,
    0
  );
  const totalYearlyProfit = totalMonthlyProfit * 12;
  const totalClients = projectionRows.reduce((s, r) => s + r.clients, 0);

  const addonsSummary = useMemo(() => {
    const quotaPart = quotaAddons
      .filter((a) => a.retailPrice > 0)
      .map(
        (a) =>
          `${a.planTier} ฿${a.retailPrice.toLocaleString("th-TH")} (พาร์ทเนอร์ ฿${a.partnerPrice.toLocaleString("th-TH")})`
      )
      .join("  |  ");
    const retPart = retentionAddons
      .filter((a) => a.retailPrice > 0)
      .map(
        (a) =>
          `${a.msgQuota} วัน ฿${a.retailPrice.toLocaleString("th-TH")} (฿${a.partnerPrice.toLocaleString("th-TH")})`
      )
      .join("  |  ");
    const parts: string[] = [];
    if (quotaPart) parts.push(`Quota: ${quotaPart}`);
    if (retPart) parts.push(`Retention: ${retPart}`);
    if (retentionAddons.some((a) => a.retailPrice < 0)) {
      parts.push("ตลอดกาล — ติดต่อทีมงาน");
    }
    return parts.join("   •   ");
  }, [quotaAddons, retentionAddons]);

  if (isLoading && planCards.length === 0) {
    return (
      <div className="py-24 text-center text-text-secondary">
        กำลังโหลดข้อมูลโครงสร้างราคา...
      </div>
    );
  }

  return (
    <>
      {error && !syncedFromApi && (
        <p className="text-center text-xs text-amber-600 py-2">
          แสดงราคาสำรองชั่วคราว
        </p>
      )}

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-gold-500 font-semibold text-sm tracking-widest uppercase mb-3">
              Pricing Structure
            </p>
            <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
              ราคาพาร์ทเนอร์{" "}
              <span className="text-grad-gold">vs ราคาปลีก</span>
            </h2>
            <p className="text-xl text-text-secondary max-w-xl mx-auto">
              คุณกำหนดราคาขายลูกค้าได้เอง — ส่วนต่างทั้งหมดเป็นของคุณ
            </p>
          </div>

          <div
            className={`grid gap-6 mb-10 ${
              planCards.length <= 3
                ? "grid-cols-1 md:grid-cols-3"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {planCards.map((p) => (
              <div
                key={p.key}
                className={`card-premium p-7 flex flex-col gap-5 relative ${
                  p.popular
                    ? "border-brand-300 bg-gradient-to-b from-brand-50 to-surface ring-2 ring-brand-500/20"
                    : ""
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="font-heading text-xl font-bold text-text-primary mb-1">
                    {p.name}
                  </h3>
                  <div className="text-sm text-text-muted">{p.msgs} ข้อความ/เดือน</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-text-secondary">ราคาปลีก (ลูกค้าจ่าย)</span>
                    <span className="font-bold text-brand-500">{p.retail}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-text-secondary">ราคาพาร์ทเนอร์ (คุณจ่าย)</span>
                    <span className="font-semibold text-text-primary">{p.wholesale}</span>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-gold-50 to-gold-100 border border-gold-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-heading font-extrabold text-grad-gold">
                    {p.profit}
                  </div>
                  <div className="text-xs text-gold-700 font-semibold mt-0.5">
                    กำไร/เดือน ({p.pct})
                  </div>
                </div>
              </div>
            ))}
          </div>

          {addonsSummary && (
            <div className="card-premium p-5 bg-surface-secondary text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Add-ons:</span> {addonsSummary}
            </div>
          )}
        </div>
      </section>

      <section className="py-24 bg-surface-secondary">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
              Revenue Projection
            </p>
            <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
              {totalClients} ลูกค้า × 12 เดือน
              <br />
              <span className="text-grad-blue">รายได้เท่าไหร่?</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3">
              <div className="card-premium overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-brand-500 text-white text-sm">
                      <th className="text-left px-5 py-3 font-semibold">แพ็กเกจ</th>
                      <th className="text-center px-4 py-3 font-semibold">ลูกค้า</th>
                      <th className="text-right px-4 py-3 font-semibold">กำไร/เดือน</th>
                      <th className="text-right px-5 py-3 font-semibold">กำไร/ปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionRows.map((r, i) => {
                      const monthly = r.profitPerClient * r.clients;
                      const yearly = monthly * 12;
                      return (
                        <tr
                          key={r.plan}
                          className={i % 2 === 0 ? "bg-surface" : "bg-brand-50"}
                        >
                          <td className="px-5 py-4 font-semibold text-text-primary">
                            {r.plan}
                          </td>
                          <td className="px-4 py-4 text-center text-text-secondary">
                            {r.clients}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-brand-500">
                            ฿{monthly.toLocaleString("th-TH")}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-text-primary">
                            ฿{yearly.toLocaleString("th-TH")}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-brand-900 text-white font-bold">
                      <td className="px-5 py-4">รวม {totalClients} ลูกค้า</td>
                      <td />
                      <td className="text-right px-4 py-4">
                        ฿{totalMonthlyProfit.toLocaleString("th-TH")}
                      </td>
                      <td className="text-right px-5 py-4">
                        ฿{totalYearlyProfit.toLocaleString("th-TH")}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-text-muted px-5 py-3">
                  * คำนวณจากส่วนต่างราคาปลีก – ราคาพาร์ทเนอร์ (Master Config) ยังไม่รวม Add-ons
                </p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="card-premium p-6 text-center border-gold-200">
                <p className="text-3xl font-heading font-extrabold text-grad-gold">
                  ฿{totalYearlyProfit.toLocaleString("th-TH")}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  รายได้ Recurring ต่อปี จาก {totalClients} ลูกค้า
                </p>
              </div>
              <div className="card-premium p-5 text-center">
                <p className="text-2xl font-bold text-brand-500">
                  ฿{totalMonthlyProfit.toLocaleString("th-TH")}
                </p>
                <p className="text-xs text-text-muted">กำไรต่อเดือน</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** แสดง margin จาก retail/partner (display-only ตามสเปก) */
export function displayPartnerMargin(retailPrice: number, partnerPrice: number) {
  const margin = retailPrice - partnerPrice;
  const marginPercent =
    retailPrice > 0 ? Math.round((margin / retailPrice) * 100) : 0;
  return { margin, marginPercent };
}
