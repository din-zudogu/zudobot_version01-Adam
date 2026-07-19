/**
 * Shared Upstash rate limiter for public endpoints.
 *
 * Anti-abuse / anti-cost-drain guard: an automated client (or AI-driven scanner)
 * hammering a public AI endpoint would otherwise burn Gemini quota and degrade
 * the service for everyone. This caps requests per identifier in a sliding window.
 *
 * FAIL-OPEN by design: if Upstash is not configured or Redis is momentarily
 * unreachable, requests are ALLOWED (and the error is logged) rather than blocking
 * all customer chat. Rate limiting is a defense layer, not a hard dependency —
 * availability of the core chat wins. WAF (edge) is the harder backstop.
 *
 * Lazy init: the Ratelimit/Redis client is built on first use, never at module
 * load, so `Redis.fromEnv()` does not run during Next.js "Collecting page data".
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

export type RateResult = {
  success:   boolean;
  limit:     number;
  remaining: number;
  reset:     number; // epoch ms when the window resets
};

const _limiters = new Map<string, Ratelimit>();

function getLimiter(prefix: string, max: number, window: Duration): Ratelimit | null {
  const cacheKey = `${prefix}|${max}|${window}`;
  const cached = _limiters.get(cacheKey);
  if (cached) return cached;

  // No Upstash config → fail-open (helper returns success without a limiter).
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    const limiter = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(max, window),
      prefix,
    });
    _limiters.set(cacheKey, limiter);
    return limiter;
  } catch (e) {
    console.error(`[rateLimit] init failed for ${prefix} — failing open:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Enforce a sliding-window limit for `identifier`. Returns a RateResult; when the
 * limiter is unavailable it returns success=true (fail-open).
 */
export async function enforceRateLimit(
  identifier: string,
  opts: { prefix: string; max: number; window: Duration },
): Promise<RateResult> {
  const limiter = getLimiter(opts.prefix, opts.max, opts.window);
  if (!limiter) {
    return { success: true, limit: opts.max, remaining: opts.max, reset: Date.now() };
  }
  try {
    return await limiter.limit(identifier);
  } catch (e) {
    console.error(`[rateLimit] ${opts.prefix} limit() error — failing open:`, e instanceof Error ? e.message : e);
    return { success: true, limit: opts.max, remaining: opts.max, reset: Date.now() };
  }
}

/** Best-effort client IP from proxy headers (Amplify/CloudFront forward these). */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}
