"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/lib/i18n";

export function CtaSection() {
  const { t } = useLang();

  const trust = [
    { icon: "🔒", label: t("landing.cta.trustPdpa") },
    { icon: "⚡", label: t("landing.cta.trust5min") },
    { icon: "💳", label: t("landing.cta.trustNocard") },
  ];

  return (
    <section className="py-24 bg-text-primary overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/60 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {t("landing.cta.badge")}
        </div>

        <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight text-balance">
          {t("landing.cta.title1")}
          <br />
          <span className="text-grad-gold">{t("landing.cta.title2")}</span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 whitespace-pre-line">
          {t("landing.cta.sub")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/register">
            <Button variant="gold" size="lg" className="w-full sm:w-auto i18n-compact-btn">
              {t("landing.cta.trial")}
            </Button>
          </Link>
          <Link href="/demo">
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-white hover:bg-white/10 border border-white/20 i18n-compact-btn"
            >
              {t("landing.cta.demo")}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {trust.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-white/50 text-xs font-medium i18n-compact">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
