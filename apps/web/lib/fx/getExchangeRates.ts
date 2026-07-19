/**
 * Exchange rate utility — always uses THB as the base currency.
 * Rates are fetched from a free public API and cached in MongoDB for 24 hours.
 * The cron job at /api/cron/refresh-exchange-rates refreshes the cache at midnight.
 */
import { connectDB } from "@/lib/db/connect";
import { ExchangeRateCacheModel } from "@/lib/db/models/ExchangeRateCache";

const BASE_CURRENCY = "THB";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FX_API_URL = `https://api.frankfurter.app/latest?from=${BASE_CURRENCY}`;

/** Fetch live rates from the public API. Returns null on network error. */
async function fetchLiveRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(FX_API_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (!data.rates || typeof data.rates !== "object") return null;
    // Add THB → THB = 1 for convenience
    return { ...data.rates, THB: 1 };
  } catch {
    return null;
  }
}

/**
 * Get today's exchange rates (THB as base).
 * Reads from MongoDB cache; refreshes if stale (>24h) or missing.
 * Never throws — returns fallback { THB: 1 } on total failure.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    await connectDB();
    const cached = await ExchangeRateCacheModel.findOne({ base: BASE_CURRENCY }).lean();
    const now = Date.now();

    if (cached && now - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return cached.rates as Record<string, number>;
    }

    const live = await fetchLiveRates();
    if (live) {
      await ExchangeRateCacheModel.findOneAndUpdate(
        { base: BASE_CURRENCY },
        { rates: live, fetchedAt: new Date() },
        { upsert: true, new: true },
      );
      return live;
    }

    // Live fetch failed — return stale cache if available, else minimal fallback
    if (cached) return cached.rates as Record<string, number>;
    return { THB: 1 };
  } catch {
    return { THB: 1 };
  }
}

/** Force-refresh the cache from the live API. Called by the cron job. */
export async function refreshExchangeRates(): Promise<{ ok: boolean; rates?: Record<string, number>; error?: string }> {
  try {
    await connectDB();
    const live = await fetchLiveRates();
    if (!live) return { ok: false, error: "fetch_failed" };

    await ExchangeRateCacheModel.findOneAndUpdate(
      { base: BASE_CURRENCY },
      { rates: live, fetchedAt: new Date() },
      { upsert: true, new: true },
    );
    return { ok: true, rates: live };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
