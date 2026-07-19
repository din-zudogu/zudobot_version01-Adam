"use client";

import { useState, useRef, useEffect } from "react";
import { useLang, LANG_META, LANG_ORDER, type Lang } from "@/lib/i18n";

interface Props {
  collapsed?: boolean;
  /** Show on public marketing header */
  variant?: "sidebar" | "header";
}

export function LanguageSwitcher({ collapsed = false, variant = "sidebar" }: Props) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = LANG_META[lang];
  const isHeader = variant === "header";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("lang.select")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "flex items-center gap-2 rounded-lg text-xs font-medium transition-colors i18n-compact",
          isHeader
            ? "px-3 py-2 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
            : "px-2 py-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary w-full",
          collapsed && !isHeader ? "justify-center" : "",
        ].join(" ")}
      >
        <span className="text-base leading-none" aria-hidden>
          {current.flag}
        </span>
        {(!collapsed || isHeader) && (
          <>
            <span className={isHeader ? "" : "flex-1 text-start"}>
              {current.nativeLabel}
            </span>
            <span className="text-[10px] opacity-60" aria-hidden>
              {open ? "▴" : "▾"}
            </span>
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("lang.select")}
          className={[
            "absolute z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-y-auto overflow-x-hidden",
            "min-w-[180px] max-h-[min(70vh,420px)]",
            collapsed && !isHeader
              ? "left-full ms-2 top-0"
              : isHeader
                ? "top-full mt-1 end-0"
                : "top-full mt-1 start-0 end-0",
          ].join(" ")}
        >
          {LANG_ORDER.map((code) => {
            const meta = LANG_META[code];
            return (
              <li key={code} role="option" aria-selected={lang === code}>
                <button
                  type="button"
                  onClick={() => {
                    setLang(code as Lang);
                    setOpen(false);
                  }}
                  className={[
                    "flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors text-start",
                    lang === code
                      ? "bg-brand-600 text-white font-semibold"
                      : "text-gray-800 hover:bg-gray-100",
                  ].join(" ")}
                >
                  <span className="text-base leading-none">{meta.flag}</span>
                  <span className="flex-1">{meta.nativeLabel}</span>
                  {lang === code && <span className="ms-auto">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
