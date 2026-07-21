import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { isSessionRevoked } from "@/lib/security/sessionRevocation";

// ── Layer 2: Dynamic CSP for /embed pages ─────────────────────────
// Fetches per-tenant allowedDomains from /api/embed/csp (Node.js runtime,
// has its own 5-min in-process cache) and sets frame-ancestors header.
// Fails open — embed still loads if CSP fetch times out or errors.
async function withEmbedCSP(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  const key      = request.nextUrl.searchParams.get("key");
  if (!key) return response;

  try {
    const origin  = new URL(request.url).origin;
    const cspRes  = await fetch(
      `${origin}/api/embed/csp?key=${encodeURIComponent(key)}`,
      {
        headers: { "x-internal-secret": process.env.INTERNAL_CRON_SECRET ?? "" },
        // Abort after 2 s — never block the embed page more than this
        signal: AbortSignal.timeout(2000),
      }
    );

    if (cspRes.ok) {
      const { domains } = (await cspRes.json()) as { domains?: string[] };
      if (domains && domains.length > 0) {
        // Build frame-ancestors: self + localhost (dev) + tenant domains (https + http)
        const domainDirectives = domains
          .map((d) => `https://${d} http://${d}`)
          .join(" ");
        response.headers.set(
          "Content-Security-Policy",
          `frame-ancestors 'self' http://localhost:* ${domainDirectives}`
        );
      }
    }
  } catch {
    // Fail open — CSP not set is better than a broken widget
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Layer 2: intercept /embed before auth logic ──────────────────
  // /api/embed/csp is excluded here (it starts with /api/embed/, handled below)
  if (pathname.startsWith("/embed")) {
    return withEmbedCSP(request);
  }

  // NextAuth v5 uses __Secure-authjs.session-token on HTTPS, authjs.session-token on HTTP.
  // Check AUTH_URL (v5) then NEXTAUTH_URL (v4 compat) to determine cookie prefix.
  const secureCookie = AMPLIFY_CONFIG.authUrl.startsWith("https://");
  const secret = AMPLIFY_CONFIG.authSecret;
  const token = await getToken({ req: request, secret, secureCookie });

  // ── Public routes — no auth required ────────────────────────────
  const isPublic =
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/checkout" ||
    pathname === "/demo" ||
    pathname === "/login" ||
    pathname === "/login/2fa" ||
    pathname === "/select-role" ||
    pathname === "/register" ||
    pathname === "/partner-benefit" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/partner/join" ||
    pathname === "/partner/verify" ||
    pathname === "/partner/checkout" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/sandbox") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/landing-demo/") ||
    pathname.startsWith("/api/widget/") ||
    pathname.startsWith("/api/embed/") ||
    pathname.startsWith("/api/public/") ||
    // Machine-to-machine cron endpoints — every handler under /api/cron/ is
    // guarded by INTERNAL_CRON_SECRET, so the session-auth redirect must not
    // intercept them (external schedulers / EventBridge carry no session cookie).
    // NOTE: only /api/internal/daily-check is secret-guarded; the rest of
    // /api/internal/* (e.g. zudo-guide) stays behind session auth — do not widen.
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/internal/daily-check" ||
    pathname === "/widget.js" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/partner/join") ||
    pathname.startsWith("/api/partner/verify") ||
    pathname.startsWith("/api/stripe/connect/callback");
  if (isPublic) return NextResponse.next();

  // ── Not logged in — redirect to login ───────────────────────────
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Force-logout check — admin-triggered session revocation ─────
  // Fail-open: if Redis is unset/unreachable, isSessionRevoked() returns false.
  if (token.sub) {
    const revoked = await isSessionRevoked(token.sub as string, (token.iat as number) ?? 0);
    if (revoked) {
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete("authjs.session-token");
      res.cookies.delete("__Secure-authjs.session-token");
      return res;
    }
  }

  const role               = token.role as string;
  const roles              = ((token as { roles?: string[] }).roles ?? []) as string[];
  const onboardingComplete = token.onboardingComplete as boolean | undefined;
  const twoFaPending       = (token as { twoFaPending?: boolean }).twoFaPending;
  const pendingDeleteAt    = (token as { pendingDeleteAt?: string }).pendingDeleteAt;
  const isImpersonating    = !!(token as { impersonating?: unknown }).impersonating;

  // Backfill: old sessions without roles array fall back to role field
  const effectiveRoles = roles.length ? roles : [role];
  const hasPartnerRole = effectiveRoles.includes("partner_admin");
  const hasTenantRole  = effectiveRoles.includes("tenant");

  // ── 2FA pending — redirect to /login/2fa unless cookie says verified ──
  if (twoFaPending) {
    const verified = request.cookies.get("zudo-2fa-ok")?.value;
    const tokenSub = token.sub as string;
    if (!verified || verified !== tokenSub) {
      if (!pathname.startsWith("/login/2fa") && !pathname.startsWith("/api/auth/verify-2fa")) {
        return NextResponse.redirect(new URL("/login/2fa", request.url));
      }
      return NextResponse.next();
    }
  }

  // ── Soft-deleted account — redirect to pending-delete notice ───────
  // Allow: the notice page itself, the recover API, and auth endpoints.
  if (pendingDeleteAt) {
    const isAllowed =
      pathname.startsWith("/account-pending-delete") ||
      pathname.startsWith("/api/tenant/account/recover") ||
      pathname.startsWith("/api/auth");
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/account-pending-delete", request.url));
    }
    return NextResponse.next();
  }

  // ── Pending registration (C path) — User doc not yet in DB ─────
  // Only allow onboarding, partner-join, auth, and user-self routes.
  if (role === "pending") {
    const isAllowed =
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/api/onboarding") ||
      pathname.startsWith("/api/user") ||
      pathname.startsWith("/partner/join") ||
      pathname.startsWith("/api/partner/join") ||
      pathname.startsWith("/partner/verify") ||
      pathname.startsWith("/api/partner/verify") ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/auth");
    if (!isAllowed) return NextResponse.redirect(new URL("/auth/new-user", request.url));
    return NextResponse.next();
  }

  // ── Tenant not yet onboarded → send to /onboarding ──────────────
  // Skip if: already on onboarding pages, in partner join flow, in /auth/* flow,
  // or user also has partner role (partners don't need tenant onboarding).
  const justOnboarded = request.cookies.get("zudo-onboarded")?.value === "1";
  if (
    hasTenantRole &&
    !hasPartnerRole &&
    !onboardingComplete &&
    !justOnboarded &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api/onboarding") &&
    !pathname.startsWith("/partner") &&
    !pathname.startsWith("/auth/")
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // ── /admin/* — super_admin or admin only ────────────────────────
  if (pathname.startsWith("/admin")) {
    if (role !== "super_admin" && role !== "admin") {
      if (hasPartnerRole) return NextResponse.redirect(new URL("/partner/overview", request.url));
      return NextResponse.redirect(new URL("/dashboard/overview", request.url));
    }
  }

  // ── /partner/* — requires partner_admin role ────────────────────
  if (
    pathname.startsWith("/partner") &&
    !pathname.startsWith("/partner/join") &&
    !pathname.startsWith("/partner/verify")
  ) {
    if (!hasPartnerRole) {
      if (role === "super_admin" || role === "admin") return NextResponse.redirect(new URL("/admin/tenants", request.url));
      // Redirect to /auth/redirect (not /dashboard) to avoid cascade → /onboarding
      return NextResponse.redirect(new URL("/auth/redirect", request.url));
    }
  }

  // ── /dashboard/* — tenant only (partner_admin-only users go to partner) ──
  if (pathname.startsWith("/dashboard")) {
    if (role === "super_admin" || role === "admin") {
      return NextResponse.redirect(new URL("/admin/tenants", request.url));
    }
    if (hasPartnerRole && !hasTenantRole && !isImpersonating) {
      return NextResponse.redirect(new URL("/partner/overview", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
