"use client";

import { useLang } from "@/lib/i18n";

const FEATURE_KEYS = ["f0", "f1", "f2", "f3", "f4", "f5"] as const;
const FEATURE_STYLE = [
  { icon: "🧠", gradient: "from-brand-50 to-cyan-50", border: "border-brand-100" },
  { icon: "⚡", gradient: "from-brand-50 to-surface-secondary", border: "border-brand-100" },
  { icon: "📦", gradient: "from-gold-50 to-surface-secondary", border: "border-gold-100" },
  { icon: "🎯", gradient: "from-gold-50 to-cyan-50", border: "border-gold-100" },
  { icon: "🔧", gradient: "from-cyan-50 to-surface-secondary", border: "border-cyan-100" },
  { icon: "🛡️", gradient: "from-emerald-50 to-surface-secondary", border: "border-emerald-100" },
];

export function FeaturesSection() {
  const { t } = useLang();

  return (
    <section id="features" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            {t("landing.features.eyebrow")}
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            {t("landing.features.title1")}
            <br />
            <span className="text-grad-blue">{t("landing.features.title2")}</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_KEYS.map((key, i) => {
            const style = FEATURE_STYLE[i];
            return (
              <div
                key={key}
                className={`card-premium bg-gradient-to-br ${style.gradient} border ${style.border} p-7`}
              >
                <div className="text-4xl mb-4">{style.icon}</div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2 i18n-compact">
                  {t(`landing.features.${key}title`)}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {t(`landing.features.${key}desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
