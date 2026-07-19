/**
 * API Key Authentication Middleware
 *
 * Two key types:
 *   x-api-key    → Public key (widget/frontend). Validated against domain whitelist.
 *   x-secret-key → Private key (server-to-server). No domain check required.
 */

import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connect";
import TenantModel from "@/models/tenant";
import type { ITenant } from "@/models/tenant";

export type AuthResult =
  | { ok: true; tenant: ITenant; keyType: "public" | "secret" }
  | { ok: false; status: number; error: string };

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const publicKey = req.headers.get("x-api-key");
  const secretKey = req.headers.get("x-secret-key");

  if (!publicKey && !secretKey) {
    return { ok: false, status: 401, error: "Missing API key. Provide x-api-key or x-secret-key header." };
  }

  await dbConnect();

  let tenant: ITenant | null = null;
  let keyType: "public" | "secret" = "public";

  if (secretKey) {
    // Server-to-server: secret key, no domain check
    tenant = await TenantModel.findOne({ secretKey }).lean() as ITenant | null;
    keyType = "secret";
  } else if (publicKey) {
    tenant = await TenantModel.findOne({ publicKey }).lean() as ITenant | null;
    keyType = "public";

    // 1 slot = 1 domain: exact match against allowedDomain (falls back to allowedDomains[0] for migration)
    const registeredDomain = tenant.allowedDomain || tenant.allowedDomains[0] || "";
    if (registeredDomain) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, "");
      const originHost = stripWww((() => {
        try { return new URL(origin).hostname; } catch { return origin; }
      })());
      const clean = stripWww(registeredDomain);
      if (originHost !== clean && !originHost.endsWith(`.${clean}`)) {
        return { ok: false, status: 403, error: `Domain not allowed: ${originHost}` };
      }
    }
  }

  if (!tenant) return { ok: false, status: 401, error: "Invalid API key." };
  if (!tenant.isActive) return { ok: false, status: 403, error: "Account is inactive." };

  const now = new Date();
  if (tenant.expiryDate && new Date(tenant.expiryDate) < now) {
    return { ok: false, status: 403, error: "Subscription expired." };
  }

  return { ok: true, tenant, keyType };
}

export function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-secret-key",
    "Access-Control-Max-Age": "86400",
  };
}
