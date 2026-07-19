import { LANG_META, DEFAULT_LANG } from "./config";
import type { Lang } from "./types";

export function formatCurrency(
  lang: Lang,
  amount: number,
  currencyOverride?: string
): string {
  const { bcp47, currency } = LANG_META[lang] ?? LANG_META[DEFAULT_LANG];
  return new Intl.NumberFormat(bcp47, {
    style: "currency",
    currency: currencyOverride ?? currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatNumber(lang: Lang, value: number): string {
  const { bcp47 } = LANG_META[lang] ?? LANG_META[DEFAULT_LANG];
  return new Intl.NumberFormat(bcp47).format(value);
}

export function formatDate(
  lang: Lang,
  date: Date | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const { bcp47 } = LANG_META[lang] ?? LANG_META[DEFAULT_LANG];
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(bcp47, options).format(d);
}

export function formatRelativeTime(
  lang: Lang,
  value: number,
  unit: Intl.RelativeTimeFormatUnit
): string {
  const { bcp47 } = LANG_META[lang] ?? LANG_META[DEFAULT_LANG];
  return new Intl.RelativeTimeFormat(bcp47, { numeric: "auto" }).format(value, unit);
}

/** Free / zero price label */
export function formatFree(lang: Lang): string {
  return lang === "th" ? "ฟรี" : "Free";
}
