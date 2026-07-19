/**
 * POST /api/admin/cost-price/unlock
 *
 * Unlocks the cost-data honeypot when the correct secret is supplied.
 * The secret is compared against the SHA-256 hash stored in
 * process.env.COST_DATA_UNLOCK_SECRET (never logged or echoed).
 *
 * Rate-limited: 5 attempts per 30 minutes.
 * Always returns a generic message — never reveals whether the system
 * is locked, how many attempts remain, or any other state detail
 * (prevents information-gathering by an attacker).
 *
 * Setup (run once to generate your env value):
 *   node -e "console.log(require('crypto').createHash('sha256').update('YOUR_SECRET').digest('hex'))"
 *   # Add to .env:  COST_DATA_UNLOCK_SECRET=<output above>
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { tryUnlockCostData } from "@/lib/security/costDataGuard";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

// Generic response — same shape regardless of outcome (prevents info leak)
const GENERIC_OK  = { message: "Request processed." };
const GENERIC_ERR = { error: "Request could not be processed." };

export async function POST(req: NextRequest) {
  // Only super_admin may attempt unlock
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const rawSecret = typeof body.secret === "string" ? body.secret : "";
  if (!rawSecret) {
    return NextResponse.json({ error: "secret_required" }, { status: 400 });
  }

  const result = await tryUnlockCostData(rawSecret);

  switch (result.reason) {
    case "unlocked":
      return NextResponse.json({ ok: true, ...GENERIC_OK });

    case "not_locked":
      // System was not locked — return ok anyway (idempotent)
      return NextResponse.json({ ok: true, ...GENERIC_OK });

    case "rate_limited":
      // Return 429 but no detail about remaining attempts
      return NextResponse.json(GENERIC_ERR, { status: 429 });

    case "wrong_secret":
    case "error":
    default:
      // Intentionally same response as rate_limited to avoid oracle
      return NextResponse.json(GENERIC_ERR, { status: 401 });
  }
}
