"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { DEFAULT_LANG, LANG_META, STORAGE_KEY, LANG_ORDER } from "./config";
import { getDictionary } from "./translations";
import { resolve } from "./merge";
import * as localeFormat from "./format";
import type { Lang } from "./types";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatNumber: (value: number) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatFree: () => string;
  /** Convert THB amount to the current language's currency using today's exchange rate. */
  convertPrice: (thbAmount: number) => string;
  /** Raw exchange rates (THB base). Empty until loaded. */
  exchangeRates: Record<string, number>;
}

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
  formatCurrency: (n) => String(n),
  formatNumber: (n) => String(n),
  formatDate: () => "",
  formatFree: () => "Free",
  convertPrice: (n) => `฿${n.toLocaleString("th-TH")}`,
  exchangeRates: {},
});

function isLang(value: string | null): value is Lang {
  return !!value && (LANG_ORDER as string[]).includes(value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [hydrated, setHydrated] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const meta = LANG_META[lang];
    document.documentElement.lang = meta.bcp47;
    document.documentElement.dir = meta.dir;
    document.documentElement.dataset.lang = lang;
    document.documentElement.dataset.uiExpand = String(meta.uiExpand);
    document.body.classList.toggle("rtl", meta.dir === "rtl");
  }, [lang, hydrated]);

  // Fetch exchange rates once on mount — cached by the server for 1 hour
  useEffect(() => {
    fetch("/api/public/exchange-rates")
      .then((r) => r.json())
      .then((d: { ok: boolean; rates: Record<string, number> }) => {
        if (d.ok && d.rates) setExchangeRates(d.rates);
      })
      .catch(() => {/* silently skip — THB prices still shown */});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const dict = useMemo(() => getDictionary(lang), [lang]);

  const t = useCallback((key: string) => resolve(dict, key), [dict]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t,
      formatCurrency: (amount, currency) =>
        localeFormat.formatCurrency(lang, amount, currency),
      formatNumber: (value) => localeFormat.formatNumber(lang, value),
      formatDate: (date, options) => localeFormat.formatDate(lang, date, options),
      formatFree: () => localeFormat.formatFree(lang),
      exchangeRates,
      convertPrice: (thbAmount: number) => {
        if (thbAmount <= 0) return localeFormat.formatFree(lang);
        if (lang === "th") {
          return `฿${thbAmount.toLocaleString("th-TH")}`;
        }
        const { currency, bcp47 } = LANG_META[lang];
        const rate = exchangeRates[currency];
        // If no rate yet (still loading) fall back to THB display
        if (!rate) return `฿${thbAmount.toLocaleString("th-TH")}`;
        const converted = thbAmount * rate;
        return new Intl.NumberFormat(bcp47, {
          style: "currency",
          currency,
          maximumFractionDigits: converted % 1 === 0 ? 0 : 2,
        }).format(converted);
      },
    }),
    [lang, setLang, t, exchangeRates]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
