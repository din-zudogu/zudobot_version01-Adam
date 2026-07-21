/**
 * POST /api/admin/accounts/[email]/actions
 * Body: { action, botState?, targetType?, reason? }
 *
 * Consolidated "full remote-control" endpoint for the unified accounts page:
 * force_logout | clear_cache | set_bot_state | suspend | reactivate | restore |
 * soft_delete | hard_delete.
 *
 * NOTE on force_logout: it is not possible to remotely delete a cookie from a
 * specific browser. This revokes the session server-side (see
 * lib/security/sessionRevocation.ts) — the NEXT request from that browser gets
 * bounced to /login by middleware.ts, not the current one instantly.
 *
 * Every branch ends with an awaited logSystemEvent(category:"admin_action") —
 * this endpoint exists specifically so these actions are auditable.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { revokeUserSessions } from "@/lib/security/sessionRevocation";
import { clearRateLimitKeysForEmail } from "@/lib/security/cacheClear";
import { logSystemEvent } from "@/lib/logging/systemLogger";
import {
  softDeleteTenant, hardDeleteTenant, restoreTenant, reactivateTenant, setTenantBotState,
} from "@/lib/admin/tenantActions";
import {
  softDeletePartner, hardDeletePartner, restorePartner, setPartnerStatus,
} from "@/lib/admin/partnerActions";
import type { BotState } from "@/types";

const PROTECTED_EMAIL = "zudogu.official@gmail.com";
const BOT_STATES: BotState[] = [
  "trial", "trial_quota_daily_exhausted", "trial_expired", "active",
  "grace_5pct", "suspended_quota", "suspended_payment", "pending_kyc", "disabled",
];
const SELF_LOCKOUT_ACTIONS = new Set(["force_logout", "hard_delete", "soft_delete"]);
const DESTRUCTIVE_ACTIONS  = new Set(["hard_delete", "soft_delete"]);

type Params = { params: Promise<{ email: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase();
  const actorEmail = (token.email as string | undefined)?.toLowerCase();

  if (email === PROTECTED_EMAIL) {
    return NextResponse.json({ error: "protected_account" }, { status: 403 });
  }

  let body: { action?: string; botState?: string; targetType?: "tenant" | "partner"; reason?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { action, botState, targetType, reason } = body;
  const validActions = [
    "force_logout", "clear_cache", "set_bot_state",
    "suspend", "reactivate", "restore", "soft_delete", "hard_delete",
  ];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  if (SELF_LOCKOUT_ACTIONS.has(action) && email === actorEmail) {
    return NextResponse.json({ error: "cannot_act_on_own_account" }, { status: 403 });
  }

  await connectDB();

  const user    = await UserModel.findOne({ email });
  const partner = await PartnerProfileModel.findOne({
    $or: [{ email }, ...(user ? [{ userId: user._id.toString() }] : [])],
  });

  if (!user && !partner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isTenant  = !!user && (user.role === "tenant" || (user.roles ?? []).includes("tenant"));
  const isPartner = !!partner || user?.role === "partner_admin" || (user?.roles ?? []).includes("partner_admin");
  const matchingTypes = [isTenant && "tenant", isPartner && "partner"].filter(Boolean);

  let resolvedTarget: "tenant" | "partner" | undefined = targetType;
  if (DESTRUCTIVE_ACTIONS.has(action) && matchingTypes.length > 1 && !targetType) {
    return NextResponse.json({ error: "target_type_required", matchingTypes }, { status: 400 });
  }
  if (!resolvedTarget) {
    resolvedTarget = isTenant ? "tenant" : isPartner ? "partner" : undefined;
  }

  const logDetails: Record<string, unknown> = { targetType: resolvedTarget, reason };

  switch (action) {
    case "force_logout": {
      if (!user) return NextResponse.json({ error: "no_active_session" }, { status: 400 });
      await revokeUserSessions(user._id.toString());
      await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
      return NextResponse.json({ ok: true, note: "Session revoked — takes effect on this account's next request." });
    }

    case "clear_cache": {
      const result = await clearRateLimitKeysForEmail(email, user?.tenantId);
      await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: { ...logDetails, ...result } });
      return NextResponse.json({ ok: true, ...result });
    }

    case "set_bot_state": {
      if (!user) return NextResponse.json({ error: "not_a_tenant" }, { status: 400 });
      if (!botState || !BOT_STATES.includes(botState as BotState)) {
        return NextResponse.json({ error: "invalid_bot_state" }, { status: 400 });
      }
      const previousState = user.botState;
      await setTenantBotState(user._id.toString(), botState);
      await logSystemEvent({
        category: "admin_action", action, email, actorEmail,
        details: { ...logDetails, previousState, nextState: botState },
      });
      return NextResponse.json({ ok: true, previousState, nextState: botState });
    }

    case "suspend": {
      if (resolvedTarget === "partner" && partner) {
        const result = await setPartnerStatus(partner._id.toString(), "suspended");
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json(result);
      }
      if (user) {
        await setTenantBotState(user._id.toString(), "disabled");
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    case "reactivate": {
      if (resolvedTarget === "partner" && partner) {
        const result = await setPartnerStatus(partner._id.toString(), "active");
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json(result);
      }
      if (user) {
        const result = await reactivateTenant(user._id.toString());
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: { ...logDetails, ...result } });
        return NextResponse.json(result);
      }
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    case "restore": {
      if (resolvedTarget === "partner" && partner) {
        const result = await restorePartner(partner._id.toString());
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json(result);
      }
      if (user) {
        const result = await restoreTenant(user._id.toString());
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: { ...logDetails, ...result } });
        return NextResponse.json(result);
      }
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    case "soft_delete": {
      if (resolvedTarget === "partner" && partner) {
        const result = await softDeletePartner(partner._id.toString());
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: { ...logDetails, ...result } });
        return NextResponse.json(result);
      }
      if (user) {
        const result = await softDeleteTenant(user._id.toString());
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: { ...logDetails, ...result } });
        return NextResponse.json({ ok: true, ...result });
      }
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    case "hard_delete": {
      if (resolvedTarget === "partner" && partner) {
        const result = await hardDeletePartner(partner._id.toString());
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json(result);
      }
      if (user) {
        await hardDeleteTenant(user._id.toString());
        await logSystemEvent({ category: "admin_action", action, email, actorEmail, details: logDetails });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    default:
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
}
