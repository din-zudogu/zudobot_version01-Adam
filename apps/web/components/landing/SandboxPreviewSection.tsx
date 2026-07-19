"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/lib/i18n";

const SCENARIO_IDS = ["fashion", "gadget", "software", "hotel", "restaurant"] as const;
const SCENARIO_STYLE: Record<
  (typeof SCENARIO_IDS)[number],
  { icon: string; color: string; border: string; dot: string; botName: string }
> = {
  fashion:    { icon: "👗", color: "from-pink-50 to-rose-50", border: "border-pink-100", dot: "bg-pink-400", botName: "Cici" },
  gadget:     { icon: "💻", color: "from-brand-50 to-cyan-50", border: "border-brand-100", dot: "bg-brand-400", botName: "ZBot Tech" },
  software:   { icon: "🖥️", color: "from-violet-50 to-purple-50", border: "border-violet-100", dot: "bg-violet-400", botName: "Aria" },
  hotel:      { icon: "🏨", color: "from-amber-50 to-orange-50", border: "border-amber-100", dot: "bg-amber-400", botName: "Hom" },
  restaurant: { icon: "🍜", color: "from-emerald-50 to-teal-50", border: "border-emerald-100", dot: "bg-emerald-400", botName: "Chef Bot" },
};

export function SandboxPreviewSection() {
  const { t } = useLang();

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-gold-500 font-semibold text-sm tracking-widest uppercase mb-3">
            {t("landing.sandbox.eyebrow")}
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            {t("landing.sandbox.title1")}
            <br />
            <span className="text-grad-gold">{t("landing.sandbox.title2")}</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-xl mx-auto">
            {t("landing.sandbox.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {SCENARIO_IDS.map((id) => {
            const s = SCENARIO_STYLE[id];
            return (
              <Link
                key={id}
                href={`/demo?scenario=${id}`}
                className={`card-premium bg-gradient-to-br ${s.color} border ${s.border} p-5 text-center group cursor-pointer`}
              >
                <div className="text-4xl mb-3">{s.icon}</div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    {s.botName}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-text-primary text-sm mb-1 i18n-compact">
                  {t(`landing.sandbox.${id}`)}
                </h3>
                <p className="text-xs text-text-muted">{t(`landing.sandbox.${id}Tone`)}</p>
                <div className="mt-3 text-brand-500 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("landing.sandbox.tryNow")}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center">
          <Link href="/demo">
            <Button variant="gold" size="lg" className="i18n-compact-btn">
              <span className="text-xl">💬</span>
              {t("landing.sandbox.cta")}
            </Button>
          </Link>
          <p className="mt-3 text-sm text-text-muted">{t("landing.sandbox.ctaNote")}</p>
        </div>
      </div>
    </section>
  );
}
