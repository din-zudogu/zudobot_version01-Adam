import type { Dict } from "./types";

export function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (
      b &&
      o &&
      typeof b === "object" &&
      typeof o === "object" &&
      !Array.isArray(b) &&
      !Array.isArray(o)
    ) {
      out[key] = deepMerge(b as Dict, o as Dict);
    } else {
      out[key] = o;
    }
  }
  return out;
}

export function resolve(dict: Dict, path: string): string {
  const parts = path.split(".");
  let node: unknown = dict;
  for (const part of parts) {
    if (node && typeof node === "object") {
      node = (node as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof node === "string" ? node : path;
}
