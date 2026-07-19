/**
 * getActivePricingRates — loads the active PricingRateMaster from MongoDB.
 *
 * Falls back to the hardcoded constants in costRateConstants.ts if no
 * default master record exists (e.g. fresh install before first seed).
 *
 * Result is cached in-process for 60 s to avoid a DB round-trip on every
 * scenario save or preview call.  Call invalidatePricingRateCache() after
 * any admin update to the master table.
 */

import { connectDB } from "@/lib/db/connect";
import {
  PricingRateMasterModel,
  masterToRateConfig,
  type IPricingRateMaster,
} from "@/lib/db/models/PricingRateMaster";
import { getDefaultRateConfig, type CostRateConfig } from "./costRateConstants";

// ─── In-process cache (single instance per serverless warm start) ─────────────

interface RateCache {
  config:  CostRateConfig;
  master:  IPricingRateMaster | null;
  ts:      number;
}

let _cache: RateCache | null = null;
const CACHE_TTL_MS = 60_000;

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the active CostRateConfig.
 * Checks in-process cache first; hits DB if stale or empty.
 */
export async function getActivePricingRates(): Promise<CostRateConfig> {
  return (await _load()).config;
}

/**
 * Returns the raw PricingRateMaster document (needed for default markup values).
 * Null means no master record in DB — caller should use hardcoded defaults.
 */
export async function getActivePricingMaster(): Promise<IPricingRateMaster | null> {
  return (await _load()).master;
}

/** Call this after any admin write to PricingRateMaster so the next call re-reads from DB. */
export function invalidatePricingRateCache(): void {
  _cache = null;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _load(): Promise<RateCache> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache;
  }

  await connectDB();
  const master = await PricingRateMasterModel.findOne({ isDefault: true }).lean() as
    IPricingRateMaster | null;

  const config = master ? masterToRateConfig(master) : getDefaultRateConfig();
  _cache = { config, master, ts: Date.now() };
  return _cache;
}
