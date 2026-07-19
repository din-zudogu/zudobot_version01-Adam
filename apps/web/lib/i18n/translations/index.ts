import type { Dict } from "../types";
import type { Lang } from "../types";
import { deepMerge } from "../merge";
import { en } from "./en";
import { th } from "./th";
import { LOCALE_PACKS } from "./packs";

function build(lang: Lang): Dict {
  if (lang === "en") return en;
  if (lang === "th") return deepMerge(en, th);
  const pack = LOCALE_PACKS[lang];
  return pack ? deepMerge(en, pack) : en;
}

const cache: Partial<Record<Lang, Dict>> = {};

export function getDictionary(lang: Lang): Dict {
  if (!cache[lang]) cache[lang] = build(lang);
  return cache[lang]!;
}
