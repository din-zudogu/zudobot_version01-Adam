import type { Lang, LangMeta } from "./types";

/** Display order: English first, Thai second, then global locales. */
export const LANG_ORDER: Lang[] = [
  "en",
  "th",
  "zh",
  "es",
  "de",
  "fr",
  "it",
  "id",
  "vi",
  "ms",
  "ar",
  "pt",
  "ja",
  "pt_br",
  "ru",
  "ko",
  "hi",
];

export const DEFAULT_LANG: Lang = "en";
export const STORAGE_KEY = "zudobot-lang";

export const LANG_META: Record<Lang, LangMeta> = {
  en:    { label: "English",    nativeLabel: "English",    flag: "🇺🇸", dir: "ltr", bcp47: "en-US", currency: "USD", uiExpand: 1 },
  th:    { label: "Thai",       nativeLabel: "ไทย",        flag: "🇹🇭", dir: "ltr", bcp47: "th-TH", currency: "THB", uiExpand: 1.05 },
  zh:    { label: "Chinese",    nativeLabel: "简体中文",   flag: "🇨🇳", dir: "ltr", bcp47: "zh-CN", currency: "CNY", uiExpand: 1.1 },
  es:    { label: "Spanish",    nativeLabel: "Español",    flag: "🇪🇸", dir: "ltr", bcp47: "es-ES", currency: "EUR", uiExpand: 1.15 },
  de:    { label: "German",     nativeLabel: "Deutsch",    flag: "🇩🇪", dir: "ltr", bcp47: "de-DE", currency: "EUR", uiExpand: 1.3 },
  fr:    { label: "French",     nativeLabel: "Français",   flag: "🇫🇷", dir: "ltr", bcp47: "fr-FR", currency: "EUR", uiExpand: 1.2 },
  it:    { label: "Italian",    nativeLabel: "Italiano",   flag: "🇮🇹", dir: "ltr", bcp47: "it-IT", currency: "EUR", uiExpand: 1.15 },
  id:    { label: "Indonesian", nativeLabel: "Indonesia",  flag: "🇮🇩", dir: "ltr", bcp47: "id-ID", currency: "IDR", uiExpand: 1.1 },
  vi:    { label: "Vietnamese", nativeLabel: "Tiếng Việt", flag: "🇻🇳", dir: "ltr", bcp47: "vi-VN", currency: "VND", uiExpand: 1.15 },
  ms:    { label: "Malay",      nativeLabel: "Bahasa Melayu", flag: "🇲🇾", dir: "ltr", bcp47: "ms-MY", currency: "MYR", uiExpand: 1.1 },
  ar:    { label: "Arabic",     nativeLabel: "العربية",    flag: "🇸🇦", dir: "rtl", bcp47: "ar-SA", currency: "SAR", uiExpand: 1.15 },
  pt:    { label: "Portuguese", nativeLabel: "Português",  flag: "🇵🇹", dir: "ltr", bcp47: "pt-PT", currency: "EUR", uiExpand: 1.2 },
  ja:    { label: "Japanese",   nativeLabel: "日本語",     flag: "🇯🇵", dir: "ltr", bcp47: "ja-JP", currency: "JPY", uiExpand: 1.1 },
  pt_br: { label: "Brazilian",  nativeLabel: "Português (BR)", flag: "🇧🇷", dir: "ltr", bcp47: "pt-BR", currency: "BRL", uiExpand: 1.2 },
  ru:    { label: "Russian",    nativeLabel: "Русский",    flag: "🇷🇺", dir: "ltr", bcp47: "ru-RU", currency: "RUB", uiExpand: 1.2 },
  ko:    { label: "Korean",     nativeLabel: "한국어",     flag: "🇰🇷", dir: "ltr", bcp47: "ko-KR", currency: "KRW", uiExpand: 1.1 },
  hi:    { label: "Hindi",      nativeLabel: "हिन्दी",   flag: "🇮🇳", dir: "ltr", bcp47: "hi-IN", currency: "INR", uiExpand: 1.15 },
};

/** @deprecated Use LANG_META — kept for LanguageSwitcher compatibility */
export const LANGS = LANG_META;
