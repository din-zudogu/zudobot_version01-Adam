"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import { getAuthErrorMessage } from "@/lib/auth/authErrors";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  master: "Master",
  enterprise: "Enterprise",
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const authErrorMessage = useMemo(
    () => getAuthErrorMessage(searchParams.get("error")),
    [searchParams]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [packageLabel, setPackageLabel] = useState<string | null>(null);

  useEffect(() => {
    const pkgId = searchParams.get("pkg");
    const planId = searchParams.get("plan");
    if (pkgId) {
      fetch(`/api/checkout/validate?pkg=${encodeURIComponent(pkgId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.package?.name) setPackageLabel(json.package.name);
        })
        .catch(() => {});
    } else if (planId) {
      setPackageLabel(PLAN_LABELS[planId] ?? planId);
    }
  }, [searchParams]);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      // Marks this as a signup attempt so /auth/redirect can show the
      // "already registered" popup if the email turns out to belong to an
      // existing account. PDPA consent itself is handled by the onboarding
      // wizard's own scroll-gated modal, not here.
      document.cookie = "zudo-auth-intent=register; path=/; max-age=1800; SameSite=Lax";

      const plan = searchParams.get("plan");
      const pkg = searchParams.get("pkg");
      let next = "";
      if (plan) next = `/checkout?plan=${encodeURIComponent(plan)}`;
      else if (pkg) next = `/checkout?pkg=${encodeURIComponent(pkg)}`;

      const callbackUrl = next ? `/auth/redirect?next=${encodeURIComponent(next)}` : "/auth/redirect";
      await signIn("google", { callbackUrl });
    } catch {
      setError("เกิดข้อผิดพลาดกับ Google Login กรุณาลองใหม่");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card-premium p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>

          {packageLabel ? (
            <div className="mb-6 px-4 py-3 rounded-xl bg-brand-50 border border-brand-200 text-center">
              <p className="text-sm text-brand-700">
                ท่านกำลังทำรายการสมัครใช้งาน ZUDOBOT ด้วยแพ็กเกจ
              </p>
              <p className="font-heading text-lg font-bold text-brand-800 mt-0.5">
                {packageLabel}
              </p>
            </div>
          ) : (
            <>
              {/* Trial badge */}
              <div className="flex justify-center mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 border border-brand-200 text-xs font-medium text-brand-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  ทดลองใช้ฟรี 14 วัน — ไม่ต้องใช้บัตรเครดิต
                </span>
              </div>

              <h1 className="font-heading text-2xl font-bold text-text-primary text-center mb-1">
                สมัครใช้งาน
              </h1>
              <p className="text-text-muted text-sm text-center mb-6">
                250 ข้อความ/วัน · ไม่ผูกบัตร · ยกเลิกเมื่อใดก็ได้
              </p>
            </>
          )}

          {(authErrorMessage || error) && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error ?? authErrorMessage}
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border-default bg-surface-primary hover:bg-surface-secondary text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                กำลังสร้างบัญชี...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                สมัครด้วย Google
              </>
            )}
          </button>

          <p className="text-center text-sm text-text-muted mt-5">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
