export function normalizeWhitelistDomain(raw: string): string | null {
  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0];

  if (!stripped || stripped.includes(" ") || !stripped.includes(".")) {
    return null;
  }

  return stripped;
}
