"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

function getCookie(name: string): string | null {
  const match = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function AlreadyRegisteredModal() {
  async function handleBackToLogin() {
    clearCookie("zudo-auth-intent");
    await signOut({ callbackUrl: "/login?already=1" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(13,24,41,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div className="card-premium w-full max-w-sm p-7 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-3xl mx-auto mb-4">
          ℹ️
        </div>
        <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
          อีเมลนี้เคยสมัครใช้งานแล้ว
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-7 whitespace-pre-wrap break-words">
          อีเมลนี้ได้สมัครใช้งาน ZUDOBOT มาก่อนหน้านี้แล้ว กรุณาเข้าสู่ระบบแทน
        </p>
        <button
          onClick={handleBackToLogin}
          className="w-full px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          กลับสู่รายการเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}

function AuthRedirectInner() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const syncStarted = useRef(false);
  const updateRef = useRef(update);
  updateRef.current = update;
  const [showAlreadyRegistered, setShowAlreadyRegistered] = useState(false);

  const user = session?.user as {
    role?: string;
    roles?: string[];
    onboardingComplete?: boolean;
  } | undefined;

  const role     = user?.role ?? "";
  const rolesKey = (user?.roles ?? []).join(",");

  // Persist ?next= across the pending → onboarding → complete round trip so
  // the original checkout/plan intent survives the multi-page auth flow.
  useEffect(() => {
    const next = searchParams.get("next");
    if (next) {
      document.cookie = `zudo-post-auth-next=${encodeURIComponent(next)}; path=/; max-age=1800; SameSite=Lax`;
    }
  }, [searchParams]);

  const redirectAfterAuth = useCallback((fallback: string) => {
    const next = getCookie("zudo-post-auth-next");
    if (next) {
      clearCookie("zudo-post-auth-next");
      router.replace(next);
    } else {
      router.replace(fallback);
    }
  }, [router]);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const isAdmin = role === "super_admin" || role === "admin";
    const intent = getCookie("zudo-auth-intent");

    if (role === "pending") {
      if (syncStarted.current) return;
      syncStarted.current = true;

      void (async () => {
        const alreadyReloaded = sessionStorage.getItem("zudo-pending-reload") === "1";
        try {
          const check = await fetch("/api/auth/sync-registration", {
            credentials: "include",
          });
          if (check.ok) {
            const data = (await check.json()) as { registered?: boolean };
            if (data.registered) {
              // The User row exists (onboarding/complete already succeeded).
              // update() must get a defined argument — next-auth only POSTs
              // (and thus only triggers the server jwt() "update" branch that
              // actually re-fetches the user from the DB) when called with a
              // defined argument; update() with zero args silently issues a
              // plain GET that just re-reads the unchanged pending cookie.
              await updateRef.current({});
              if (!alreadyReloaded) {
                // Force one full reload so middleware/SSR decode the
                // now-updated cookie fresh on a real request, rather than
                // relying on this SPA's useSession() state to reflect the
                // change in place. Guarded by sessionStorage so a genuine
                // failure (cookie never updated) doesn't reload forever.
                sessionStorage.setItem("zudo-pending-reload", "1");
                window.location.reload();
                return;
              }
              sessionStorage.removeItem("zudo-pending-reload");
            }
          }
        } catch {
          // fall through
        }
        router.replace("/auth/new-user");
      })();
      return;
    }

    // Existing account signing in via a "register" CTA — surface the popup
    // instead of silently continuing into the dashboard.
    if (intent === "register") {
      clearCookie("zudo-auth-intent");
      setShowAlreadyRegistered(true);
      return;
    }

    if (isAdmin) {
      redirectAfterAuth("/admin/tenants");
    } else {
      redirectAfterAuth("/select-role");
    }
  }, [status, role, rolesKey, router, session, redirectAfterAuth]);

  if (showAlreadyRegistered) return <AlreadyRegisteredModal />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AuthRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthRedirectInner />
    </Suspense>
  );
}
