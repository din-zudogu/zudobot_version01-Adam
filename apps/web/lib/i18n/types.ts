/** Supported UI languages — English default, then Thai, then global locales. */
export type Lang =
  | "en"
  | "th"
  | "zh"
  | "es"
  | "de"
  | "fr"
  | "it"
  | "id"
  | "vi"
  | "ms"
  | "ar"
  | "pt"
  | "ja"
  | "pt_br"
  | "ru"
  | "ko"
  | "hi";

export type Dict = Record<string, unknown>;

export type TextDirection = "ltr" | "rtl";

export interface LangMeta {
  label: string;
  nativeLabel: string;
  flag: string;
  dir: TextDirection;
  /** BCP 47 tag for Intl APIs */
  bcp47: string;
  /** Default regional currency for display formatting */
  currency: string;
  /** UI copy expansion factor vs English (e.g. German ~1.3) */
  uiExpand: number;
}
