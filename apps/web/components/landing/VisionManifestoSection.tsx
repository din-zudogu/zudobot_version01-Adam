"use client";

import { useLang } from "@/lib/i18n";

const PILLARS = [
  { icon: "🔬", titleKey: "landing.vision.p0title", descKey: "landing.vision.p0desc", grad: "from-brand-50 to-cyan-50" },
  { icon: "🛠️", titleKey: "landing.vision.p1title", descKey: "landing.vision.p1desc", grad: "from-gold-50 to-surface-secondary" },
  { icon: "🚀", titleKey: "landing.vision.p2title", descKey: "landing.vision.p2desc", grad: "from-cyan-50 to-brand-50" },
] as const;

export function VisionManifestoSection() {
  const { t } = useLang();

  return (
    <section id="vision" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            {t("landing.vision.eyebrow")}
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            {t("landing.vision.title1")}{" "}
            <span className="text-grad-blue">{t("landing.vision.title2")}</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            {t("landing.vision.subtitle")}
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PILLARS.map((p) => (
            <div
              key={p.titleKey}
              className={`card-premium bg-gradient-to-br ${p.grad} border-brand-100 p-7`}
            >
              <div className="text-4xl mb-4" aria-hidden>{p.icon}</div>
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                {t(p.titleKey)}
              </h3>
              <p className="text-text-secondary leading-relaxed">
                {t(p.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Mission statement */}
        <div className="mt-16 card-premium bg-gradient-to-r from-brand-50 to-cyan-50 border-brand-100 p-8 sm:p-10 text-center">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            {t("landing.vision.missionLabel")}
          </p>
          <p className="font-heading text-2xl sm:text-3xl font-extrabold text-text-primary text-balance max-w-3xl mx-auto">
            &ldquo;{t("landing.vision.mission")}&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
