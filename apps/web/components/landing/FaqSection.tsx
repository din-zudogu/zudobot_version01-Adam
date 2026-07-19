"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n";

const FAQ_INDICES = [0, 1, 2, 3, 4, 5] as const;

export function FaqSection() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            {t("landing.faq.eyebrow")}
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
            {t("landing.faq.title")}
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_INDICES.map((i) => (
            <div
              key={i}
              className={cn(
                "card-premium overflow-hidden transition-all duration-300",
                open === i && "border-brand-200 shadow-card-hover"
              )}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-6 py-5 text-start gap-4"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-heading font-semibold text-text-primary i18n-compact">
                  {t(`landing.faq.q${i}`)}
                </span>
                <span
                  className={cn(
                    "text-brand-500 text-xl shrink-0 transition-transform duration-300",
                    open === i && "rotate-180"
                  )}
                >
                  ▾
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-text-secondary leading-relaxed border-t border-[rgba(13,24,41,0.06)] pt-4">
                  {t(`landing.faq.a${i}`)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
