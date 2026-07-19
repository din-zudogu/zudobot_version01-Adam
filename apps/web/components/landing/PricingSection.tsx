"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import type { PublicPricingSnapshot } from "@/lib/pricing/buildPublicPricing";
import { usePricingSync } from "@/hooks/usePricingSync";
import { mapPublicPackagesToSnapshot } from "@/lib/pricing/mapPublicPackagesToSnapshot";
import { STATIC_PRICING_FALLBACK } from "@/lib/pricing/staticPricingFallback";

type Tab = "base" | "quota" | "retention";

type Props = {
  /** Server snapshot — fallback เมื่อ client API ยังไม่พร้อม */
  pricing?: PublicPricingSnapshot;
};

export function PricingSection({ pricing: serverPricing }: Props) {
  const [tab, setTab] = useState<Tab>("base");
  const { packages, isLoading, syncedFromApi, error } = usePricingSync({ cycle: "1m" });

  const pricing = useMemo((): PublicPricingSnapshot => {
    if (syncedFromApi && packages.length > 0) {
      return mapPublicPackagesToSnapshot(packages, "1m");
    }
    if (serverPricing && serverPricing.basePlans.length > 0) {
      return serverPricing;
    }
    return STATIC_PRICING_FALLBACK;
  }, [syncedFromApi, packages, serverPricing]);

  const basePlans = pricing.basePlans;
  const quotaAddons = pricing.quotaAddons;
  const retentionAddons = pricing.retentionAddons;

  function planHref(planId: string) {
    return `/register?plan=${planId}`;
  }

  function formatQuotaDisplay(n: number): string {
    if (n < 0) return "ไม่จำกัด";
    return n.toLocaleString("th-TH");
  }

  if (isLoading && basePlans.length === 0) {
    return (
      <section id="pricing" className="py-24 bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-4 text-center py-20 text-text-secondary">
          กำลังโหลดข้อมูลแพ็กเกจ...
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && syncedFromApi === false && (
          <p className="text-center text-xs text-amber-600 mb-4">
            แสดงราคาสำรองชั่วคราว — ไม่สามารถซิงก์จากเซิร์ฟเวอร์ได้
          </p>
        )}
        <div className="text-center mb-12">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            ราคาและแพ็กเกจ
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
            เลือกแพ็กเกจที่<br />
            <span className="text-grad-blue">เหมาะกับธุรกิจคุณ</span>
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            ราคาทั้งหมดยังไม่รวม VAT 7% • ทดลองฟรี 14 วัน ไม่ต้องใส่บัตร
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="glass-card rounded-2xl p-1.5 flex gap-1">
            {(["base", "quota", "retention"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
                  tab === t
                    ? "bg-brand-500 text-white shadow-md"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {t === "base" && "📦 Base Plan"}
                {t === "quota" && "🗄️ พื้นที่เก็บข้อมูล"}
                {t === "retention" && "📅 Retention Add-on"}
              </button>
            ))}
          </div>
        </div>

        {tab === "base" && (
          <>
            <div
              className={cn(
                "grid gap-6 max-w-6xl mx-auto",
                basePlans.length <= 3
                  ? "grid-cols-1 md:grid-cols-3"
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {basePlans.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "card-premium p-7 flex flex-col relative",
                    p.isPopular && "border-brand-300 shadow-brand ring-2 ring-brand-500/20"
                  )}
                >
                  {p.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="blue">ยอดนิยม</Badge>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="font-heading text-2xl font-extrabold text-text-primary mb-1">
                      {p.tier}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold text-text-primary font-heading">
                        {p.retailPrice.toLocaleString("th-TH")}
                      </span>
                      <span className="text-text-muted text-sm">฿/เดือน</span>
                    </div>
                    <p className="text-sm text-text-muted">
                      {formatQuotaDisplay(p.messageQuota)} ข้อความ/เดือน
                    </p>
                  </div>
                  <ul className="space-y-3 flex-1 mb-7">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-brand-500 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={planHref(p.checkoutPlanId)}>
                    <Button
                      variant={p.isPopular ? "primary" : "outline"}
                      size="md"
                      className="w-full"
                    >
                      เริ่มใช้งาน
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-8 card-premium border-gold-glow max-w-2xl mx-auto p-6 text-center">
              <Badge variant="gold" className="mb-3">
                Enterprise
              </Badge>
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                สำหรับองค์กรขนาดใหญ่
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Pay-per-use • KYC นิติบุคคล • วางบิลรายเดือน • SLA & Contract
                <br />
                คิดตาม API cost จริง (Cost-Plus Pricing)
              </p>
              <Link href="mailto:enterprise@zudogu.com">
                <Button variant="gold" size="sm">
                  ติดต่อฝ่าย Enterprise →
                </Button>
              </Link>
            </div>

            <div className="mt-6 text-center">
              <p className="text-text-muted text-sm">
                ทุกแพ็กเกจรองรับทั้งบุคคลธรรมดาและนิติบุคคล (ยกเว้น Enterprise รับเฉพาะนิติบุคคล)
              </p>
            </div>
          </>
        )}

        {tab === "quota" && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-text-secondary text-sm font-medium mb-1">
                พื้นที่จัดเก็บประวัติการสนทนาระหว่างลูกค้ากับ Zudobot
              </p>
              <p className="text-text-muted text-xs">
                ซื้อได้ทุก Plan • ยิ่งเก็บประวัติมาก บอทยิ่งจำลูกค้าได้แม่นขึ้น • รีเซ็ตต้นเดือน
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quotaAddons.map((a) => (
                <div
                  key={a.id}
                  className="card-premium p-6 flex flex-col items-center text-center gap-3"
                >
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="font-heading text-2xl font-extrabold text-text-primary">
                        +{a.extraMessages.toLocaleString("th-TH")}
                      </span>
                      {a.tag && <Badge variant="gold">{a.tag}</Badge>}
                    </div>
                    <p className="text-sm text-text-muted font-medium">ประวัติสนทนา/เดือน</p>
                  </div>
                  <div>
                    <span className="text-2xl font-extrabold text-text-primary font-heading">
                      +{a.retailPrice.toLocaleString("th-TH")}
                    </span>
                    <span className="text-text-muted text-sm"> ฿/เดือน</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-brand-50 border border-brand-200 rounded-2xl p-4 text-center text-sm text-brand-700">
              <span className="font-semibold">💡 ทำไมต้องซื้อพื้นที่เพิ่ม?</span>
              <span className="ml-2 text-brand-600">
                บอทใช้ประวัติการสนทนาเพื่อจดจำชื่อ ความสนใจ และพฤติกรรมของลูกค้าแต่ละราย
                ทำให้ตอบได้แม่นยำและเป็นส่วนตัวมากขึ้น
              </span>
            </div>
            <div className="mt-6 text-center">
              <Link href="/register">
                <Button variant="primary" size="md">
                  เริ่มต้นใช้งาน →
                </Button>
              </Link>
            </div>
          </div>
        )}

        {tab === "retention" && (
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-text-muted text-sm mb-8">
              เลือกซื้อได้ทุก Plan • ระบบจะแจ้งเตือน Dashboard ล่วงหน้า 5 วันก่อนข้อมูลถูกลบ
            </p>
            <div className="space-y-3">
              {retentionAddons.map((a) => (
                <div
                  key={a.id}
                  className="card-premium p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-text-primary">
                          {a.periodLabel}
                        </span>
                        {a.tag && (
                          <Badge
                            variant={
                              a.tag === "มาตรฐาน"
                                ? "green"
                                : a.tag === "สำหรับองค์กร"
                                  ? "gold"
                                  : "blue"
                            }
                          >
                            {a.tag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        เก็บประวัติลูกค้า {a.periodLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {a.displayPrice === "ฟรี" ? (
                      <span className="text-xl font-extrabold text-emerald-500 font-heading">
                        ฟรี
                      </span>
                    ) : a.displayPrice === "Custom" ? (
                      <span className="text-sm font-semibold text-gold-500">ราคา Custom</span>
                    ) : (
                      <>
                        <span className="text-xl font-extrabold text-text-primary font-heading">
                          +{a.displayPrice}
                        </span>
                        <span className="text-text-muted text-sm"> ฿/เดือน</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/register">
                <Button variant="primary" size="md">
                  เริ่มต้นด้วย 7 วันฟรี →
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
