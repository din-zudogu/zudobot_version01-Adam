"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

type TokenStatus = "loading" | "valid" | "expired" | "locked" | "not_found" | "already_joined";

function VerifyForm() {
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const { data: session, status: authStatus, update } = useSession();

  const [tokenStatus,  setTokenStatus]  = useState<TokenStatus>("loading");
  const [companyName,  setCompanyName]  = useState("");
  const [code,         setCode]         = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [signingIn,    setSigningIn]    = useState(false);
  const [error,        setError]        = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const didRedirect = useRef(false);

  // Check token validity on mount (public GET — no auth required)
  useEffect(() => {
    if (!token) { setTokenStatus("not_found"); return; }
    fetch(`/api/partner/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        setTokenStatus(d.status ?? "not_found");
        setCompanyName(d.companyName ?? "");
      })
      .catch(() => setTokenStatus("not_found"));
  }, [token]);

  // If already partner_admin, redirect immediately (already activated)
  useEffect(() => {
    if (didRedirect.current) return;
    if (authStatus !== "authenticated" || !session) return;
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const role  = (session.user as { role?: string }).role ?? "";
    if (roles.includes("partner_admin") || role === "partner_admin") {
      didRedirect.current = true;
      window.location.replace("/partner/overview");
    }
  }, [authStatus, session]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await signIn("google", {
      callbackUrl: `/partner/verify?token=${encodeURIComponent(token)}`,
    });
  }

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAttemptsLeft(null);
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError("กรุณากรอกรหัส 6 หลัก (ตัวเลข 0–9)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "locked") {
          setTokenStatus("locked");
        } else if (data.error === "invalid_code") {
          setAttemptsLeft(data.attemptsLeft ?? null);
          setError("รหัสไม่ถูกต้อง");
          setCode("");
        } else if (data.error === "email_mismatch") {
          setError(`กรุณาเข้าสู่ระบบด้วยอีเมล: ${data.inviteEmail}`);
        } else if (data.error === "expired") {
          setTokenStatus("expired");
        } else if (data.error === "already_joined") {
          await update();
          window.location.replace("/partner/overview");
        } else {
          setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        }
        return;
      }

      // Refresh JWT so middleware sees partner_admin role, then redirect
      await update();
      window.location.replace("/partner/overview");
    } catch {
      setError("Network error — กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Error states ────────────────────────────────────────────────────────────
  if (tokenStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tokenStatus === "not_found") {
    return <ErrorCard title="ลิงก์ไม่ถูกต้อง" message="ลิงก์นี้ไม่ถูกต้องหรือถูกใช้งานไปแล้ว กรุณาตรวจสอบลิงก์จากอีเมลอีกครั้ง" />;
  }

  if (tokenStatus === "expired") {
    return <ErrorCard title="ลิงก์หมดอายุ" message="ลิงก์นี้หมดอายุแล้ว (มีอายุ 24 ชั่วโมง) กรุณาติดต่อแอดมินเพื่อขอลิงก์ใหม่" />;
  }

  if (tokenStatus === "locked") {
    return <ErrorCard title="บัญชีถูกล็อก" message="กรอกรหัสผิดเกิน 5 ครั้ง — ลิงก์นี้ถูกล็อกแล้ว กรุณาติดต่อแอดมินเพื่อขอรหัสใหม่" />;
  }

  if (tokenStatus === "already_joined") {
    return <ErrorCard title="เปิดใช้งานแล้ว" message="บัญชีนี้ได้รับการยืนยันเรียบร้อยแล้ว กรุณาเข้าสู่ระบบปกติ" />;
  }

  // ── Session loading ──────────────────────────────────────────────────────────
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Phase 1: Not authenticated — show Google Sign-In ────────────────────────
  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
        <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>

          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 border border-brand-100 text-lg mx-auto mb-4">
            🤝
          </div>

          <h1 className="text-xl font-bold text-text-primary text-center mb-1">Partner Verification</h1>
          {companyName && (
            <p className="text-sm text-text-muted text-center mb-1">
              สำหรับ <span className="font-semibold text-text-primary">{companyName}</span>
            </p>
          )}
          <p className="text-sm text-text-muted text-center mb-6">
            ขั้นตอนที่ 1/2 — เข้าสู่ระบบด้วย Google Gmail
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border-default bg-surface-primary hover:bg-surface-secondary text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {signingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                กำลังเชื่อมต่อ…
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </>
            )}
          </button>

          <p className="text-xs text-text-muted text-center mt-4 leading-relaxed">
            กรุณาเข้าสู่ระบบด้วยอีเมล Gmail ที่ได้รับคำเชิญ<br />
            หลังจากนั้นจะต้องกรอก Verify Code 6 หลัก
          </p>
        </div>
      </div>
    );
  }

  // ── Phase 2: Authenticated — show code entry ─────────────────────────────────
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <ZudobotLogo size="md" variant="color" />
        </div>

        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 border border-green-100 text-lg mx-auto mb-4">
          🔐
        </div>

        <h1 className="text-xl font-bold text-text-primary text-center mb-1">Partner Verification</h1>
        {companyName && (
          <p className="text-sm text-text-muted text-center mb-1">
            สำหรับ <span className="font-semibold text-text-primary">{companyName}</span>
          </p>
        )}
        <p className="text-sm text-text-muted text-center mb-4">
          ขั้นตอนที่ 2/2 — กรอก Verify Code
        </p>

        {/* Signed-in email badge */}
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-5">
          <span className="text-green-600 text-sm">✓</span>
          <p className="text-xs text-green-700 truncate">เข้าสู่ระบบด้วย <strong>{userEmail}</strong></p>
          <button
            onClick={() => signOut({ callbackUrl: `/partner/verify?token=${encodeURIComponent(token)}` })}
            className="ml-auto text-xs text-text-muted hover:text-text-primary underline shrink-0"
          >
            เปลี่ยน
          </button>
        </div>

        <form onSubmit={handleSubmitCode} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              Verify Code (6 หลัก)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                setError("");
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3.5 text-2xl font-bold tracking-widest text-text-primary text-center focus:outline-none focus:border-brand-400 transition-colors font-mono"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-xs text-red-700">{error}</p>
              {attemptsLeft !== null && (
                <p className="text-xs text-red-600 mt-0.5 font-medium">
                  เหลือโอกาสอีก {attemptsLeft} ครั้ง — หากผิดเกิน 5 ครั้งจะถูกล็อก
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังยืนยัน…
              </span>
            ) : (
              "ยืนยัน →"
            )}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-4 leading-relaxed">
          ติดต่อแอดมินหากไม่ทราบ Verify Code
        </p>
      </div>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-sm text-text-muted mb-6">{message}</p>
        <a href="/login" className="text-sm text-brand-600 hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </a>
      </div>
    </div>
  );
}

export default function PartnerVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
