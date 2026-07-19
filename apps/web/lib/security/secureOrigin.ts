const HOSTNAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Extract and normalize hostname from Origin or Referer.
 * Rejects malformed hosts and subdomain-spoof patterns (exact host only downstream).
 */
export function secureExtractDomain(urlString: string | null): string | null {
  if (!urlString?.trim()) return null;

  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname.includes("/") || hostname.includes("@")) return null;
    if (!HOSTNAME_PATTERN.test(hostname)) return null;

    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

/**
 * Resolve request domain from Origin and Referer.
 * If both are present they must agree (anti-spoof).
 */
export function resolveRequestDomain(
  originHeader: string | null,
  refererHeader: string | null
): string | null {
  const fromOrigin = secureExtractDomain(originHeader);
  const fromReferer = secureExtractDomain(refererHeader);

  if (fromOrigin && fromReferer && fromOrigin !== fromReferer) {
    return null;
  }

  return fromOrigin ?? fromReferer;
}

export function normalizeWhitelistDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/^www\./, "");
}

export function isDomainExplicitlyWhitelisted(
  requestDomain: string,
  whitelistedDomains: string[]
): boolean {
  const normalizedRequest = requestDomain.toLowerCase();
  return whitelistedDomains.some(
    (entry) => normalizeWhitelistDomain(entry) === normalizedRequest
  );
}

/**
 * Build a safe Access-Control-Allow-Origin value (never "*").
 * Must match the whitelisted domain exactly.
 */
export function buildCorsAllowOrigin(
  originHeader: string | null,
  refererHeader: string | null,
  allowedDomain: string
): string | null {
  const candidates: string[] = [];

  if (originHeader?.trim()) {
    try {
      const parsed = new URL(originHeader.trim());
      candidates.push(`${parsed.protocol}//${parsed.host}`);
    } catch {
      return null;
    }
  }

  if (refererHeader?.trim()) {
    try {
      const parsed = new URL(refererHeader.trim());
      const synthetic = `${parsed.protocol}//${parsed.host}`;
      if (!candidates.includes(synthetic)) {
        candidates.push(synthetic);
      }
    } catch {
      return null;
    }
  }

  for (const candidate of candidates) {
    const host = secureExtractDomain(candidate);
    if (host && host === allowedDomain) {
      return candidate;
    }
  }

  return null;
}
