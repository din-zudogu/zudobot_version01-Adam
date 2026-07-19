"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useLang } from "@/lib/i18n";

export function HeroSection() {
  const { t } = useLang();

  const stats = [
    { value: t("landing.hero.stat247val"), label: t("landing.hero.stat247") },
    { value: t("landing.hero.stat5minval"), label: t("landing.hero.stat5min") },
    { value: t("landing.hero.stat14dval"), label: t("landing.hero.stat14d") },
    { value: t("landing.hero.statPdpaval"), label: t("landing.hero.statPdpa") },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-brand-500/8 blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-cyan-400/8 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(#1E5BC6 1px, transparent 1px), linear-gradient(to right, #1E5BC6 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center mb-8 animate-fade-in">
          <Badge variant="blue" className="text-sm px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            {t("landing.hero.badge")}
          </Badge>
        </div>

        <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6 animate-fade-in text-balance">
          {t("landing.hero.h1a")}
          <br />
          <span className="text-grad-blue">{t("landing.hero.h1b")}</span>
          <br />
          <span className="text-grad-gold">{t("landing.hero.h1c")}</span>
        </h1>

        <p className="text-xl sm:text-2xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in whitespace-pre-line">
          {t("landing.hero.sub")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in">
          <Link href="/register">
            <Button variant="primary" size="lg" className="w-full sm:w-auto i18n-compact-btn">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t("landing.hero.ctaTrial")}
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" size="lg" className="w-full sm:w-auto i18n-compact-btn">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t("landing.hero.ctaDemo")}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="card-premium px-4 py-4 text-center">
              <div className="text-2xl font-heading font-extrabold text-grad-blue mb-1">{s.value}</div>
              <div className="text-xs text-text-muted font-medium i18n-compact">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-text-muted">{t("landing.hero.note")}</p>
      </div>
    </section>
  );
}
