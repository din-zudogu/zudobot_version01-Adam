/**
 * costDataGuard — Zudobot Cost-Data Protection System
 *
 * Implements three defensive layers for the admin cost-price endpoints:
 *
 *   1. Auth-failure tracking  — 10 failed auth attempts in 15 min → LOCK
 *   2. Export-abuse tracking  — 3 bulk exports in 5 min → LOCK
 *   3. Honeypot mode          — when LOCKED, return plausible fake data;
 *                               real data is NEVER deleted, just withheld
 *
 * Unlock:
 *   POST /api/admin/cost-price/unlock  { secret: "<raw-value>" }
 *   The secret is compared against process.env.COST_DATA_UNLOCK_SECRET
 *   (set to SHA-256 hex of your chosen unlock phrase — never log it).
 *   Rate-limited: max 5 attempts per 30 min to prevent brute-force.
 *
 * False-positive prevention:
 *   • Lock ONLY fires on threshold breach, not single suspicious events.
 *   • Normal admin dashboard traffic (1 GET, 1 PUT, 1 export per session)
 *     never approaches thresholds.
 *   • Failed auth counter resets when the window expires (15 min rolling).
 *   • Export counter resets when the window expires (5 min rolling).
 *
 * Setup:
 *   Set COST_DATA_UNLOCK_SECRET in your .env to the SHA-256 hex hash of
 *   your unlock phrase. Example (Node.js):
 *     require("crypto").createHash("sha256").update("DD/MM/YYYY").digest("hex")
 *   Never store or log the raw phrase anywhere.
 */

import crypto from "crypto";
import { connectDB } from "@/lib/db/connect";
import { SecurityStateModel } from "@/lib/db/models/SecurityState";

// ─── Thresholds ──────────────────────────────────────────────────────────────

const STATE_KEY = "cost_data_lock";

const AUTH_FAILURE_THRESHOLD  = 10;
const AUTH_FAILURE_WINDOW_MS  = 15 * 60 * 1000; // 15 min

const EXPORT_THRESHOLD        = 3;
const EXPORT_WINDOW_MS        = 5  * 60 * 1000; // 5 min

const UNLOCK_ATTEMPT_MAX      = 5;
const UNLOCK_ATTEMPT_WINDOW_MS = 30 * 60 * 1000; // 30 min

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashSecret(raw: string): string {
  return crypto.createHash("sha256").update(raw.trim()).digest("hex");
}

async function getState() {
  await connectDB();
  return (
    await SecurityStateModel.findOne({ key: STATE_KEY }) ??
    await SecurityStateModel.create({ key: STATE_KEY })
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true when the system is in lockdown (honeypot mode). */
export async function isCostDataLocked(): Promise<boolean> {
  try {
    const state = await getState();
    return state.isLocked;
  } catch {
    return false; // fail-open: don't block admin on DB errors
  }
}

/**
 * Record a failed authentication attempt on a cost-price endpoint.
 * Activates lockdown when the threshold is exceeded within the window.
 */
export async function recordAuthFailure(): Promise<void> {
  try {
    const state = await getState();
    if (state.isLocked) return; // already locked

    const now = new Date();
    const windowStart = state.failedAuthWindowStart;
    const expired = !windowStart || now.getTime() - windowStart.getTime() > AUTH_FAILURE_WINDOW_MS;

    if (expired) {
      state.failedAuthCount = 1;
      state.failedAuthWindowStart = now;
    } else {
      state.failedAuthCount += 1;
    }

    if (state.failedAuthCount >= AUTH_FAILURE_THRESHOLD) {
      state.isLocked   = true;
      state.lockedAt   = now;
      state.lockReason = "auth_failure_threshold";
      state.totalLockCount += 1;
    }

    await state.save();
  } catch {
    // Silently absorb — guard must not break the auth flow
  }
}

/**
 * Record a bulk-export request.
 * Activates lockdown when too many exports happen in a short window.
 */
export async function recordExportRequest(): Promise<void> {
  try {
    const state = await getState();
    if (state.isLocked) return;

    const now = new Date();
    const windowStart = state.exportWindowStart;
    const expired = !windowStart || now.getTime() - windowStart.getTime() > EXPORT_WINDOW_MS;

    if (expired) {
      state.exportCount = 1;
      state.exportWindowStart = now;
    } else {
      state.exportCount += 1;
    }

    if (state.exportCount >= EXPORT_THRESHOLD) {
      state.isLocked   = true;
      state.lockedAt   = now;
      state.lockReason = "export_abuse";
      state.totalLockCount += 1;
    }

    await state.save();
  } catch {
    // Silently absorb
  }
}

export interface UnlockResult {
  ok: boolean;
  reason: "unlocked" | "wrong_secret" | "rate_limited" | "not_locked" | "error";
}

/**
 * Attempt to unlock the system with the provided raw secret.
 * Rate-limited to prevent brute-force of the unlock phrase.
 * The raw secret is NEVER logged or stored.
 */
export async function tryUnlockCostData(rawSecret: string): Promise<UnlockResult> {
  const configuredHash = process.env.COST_DATA_UNLOCK_SECRET ?? "";
  if (!configuredHash) {
    // Env not configured — cannot unlock via API
    return { ok: false, reason: "error" };
  }

  try {
    const state = await getState();

    // Rate-limit unlock attempts
    const now = new Date();
    const windowStart = state.unlockAttemptWindowStart;
    const expired = !windowStart || now.getTime() - windowStart.getTime() > UNLOCK_ATTEMPT_WINDOW_MS;

    if (expired) {
      state.unlockAttemptCount = 1;
      state.unlockAttemptWindowStart = now;
    } else {
      state.unlockAttemptCount += 1;
    }

    if (state.unlockAttemptCount > UNLOCK_ATTEMPT_MAX) {
      await state.save();
      return { ok: false, reason: "rate_limited" };
    }

    if (!state.isLocked) {
      await state.save();
      return { ok: false, reason: "not_locked" };
    }

    // Constant-time comparison to prevent timing attacks
    const inputHash = hashSecret(rawSecret);
    const match = crypto.timingSafeEqual(
      Buffer.from(inputHash,      "hex"),
      Buffer.from(configuredHash, "hex"),
    );

    if (!match) {
      await state.save();
      return { ok: false, reason: "wrong_secret" };
    }

    // Unlock
    state.isLocked              = false;
    state.lockedAt              = undefined;
    state.lockReason            = undefined;
    state.failedAuthCount       = 0;
    state.failedAuthWindowStart = undefined;
    state.exportCount           = 0;
    state.exportWindowStart     = undefined;
    state.unlockAttemptCount    = 0;
    state.lastUnlockedAt        = now;
    await state.save();

    return { ok: true, reason: "unlocked" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// ─── Honeypot Data ────────────────────────────────────────────────────────────

/**
 * Returns structurally-valid but entirely fake cost-price scenarios.
 * Used as honeypot data when the system is locked.
 * Values are plausible-looking but do not reflect any real cost structure.
 */
export function generateHoneypotScenarios(): unknown[] {
  return [
    {
      _id: "hp000000000000000000000a",
      label: "AI Base — Starter (1 เดือน)",
      plan: "AI Base", packageName: "Starter",
      isActive: true, isOnSale: true, sortOrder: 1,
      inputs: {
        plan: "AI Base", packageName: "Starter",
        aiBaseMonths: 1, messageCount: 1000,
        bestPriceZudobot: 1499, bestPricePartner: 1199,
      },
      calculated: {
        totalCostAr: 423, profitZudobot: 1076, profitPct: 71.8,
        vat7Zudobot: 104.93, wht3Zudobot: 44.97,
        vat7Partner: 83.93, wht3Partner: 35.97,
      },
    },
    {
      _id: "hp000000000000000000000b",
      label: "AI Base — Pro (1 เดือน)",
      plan: "AI Base", packageName: "Pro",
      isActive: true, isOnSale: true, sortOrder: 2,
      inputs: {
        plan: "AI Base", packageName: "Pro",
        aiBaseMonths: 1, messageCount: 5000,
        bestPriceZudobot: 2999, bestPricePartner: 2399,
      },
      calculated: {
        totalCostAr: 1102, profitZudobot: 1897, profitPct: 63.3,
        vat7Zudobot: 209.93, wht3Zudobot: 89.97,
        vat7Partner: 167.93, wht3Partner: 71.97,
      },
    },
    {
      _id: "hp000000000000000000000c",
      label: "AI Base — Super (1 เดือน)",
      plan: "AI Base", packageName: "Super",
      isActive: true, isOnSale: true, sortOrder: 3,
      inputs: {
        plan: "AI Base", packageName: "Super",
        aiBaseMonths: 1, messageCount: 25000,
        bestPriceZudobot: 7990, bestPricePartner: 6390,
      },
      calculated: {
        totalCostAr: 3241, profitZudobot: 4749, profitPct: 59.4,
        vat7Zudobot: 559.30, wht3Zudobot: 239.70,
        vat7Partner: 447.30, wht3Partner: 191.70,
      },
    },
  ];
}
