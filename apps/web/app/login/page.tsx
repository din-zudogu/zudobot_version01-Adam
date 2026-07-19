"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import { Suspense, useMemo } from "react";
import { getAuthErrorMessage } from "@/lib/auth/authErrors";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") ?? "/select-role";
  const callbackUrl = rawCallback.startsWith("/") ? rawCallback : "/select-role";
  const authErrorCode = searchParams.get("error");

  const authErrorMessage = useMemo(
    () => getAuthErrorMessage(authErrorCode),
    [authErrorCode]
  );

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("เกิดข้อผิดพลาดกับ Google Login กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
      if (result?.error) {
        setError(getAuthErrorMessage("CredentialsSignin"));
        setLoading(false);
        return;
      }
      window.location.href = result?.url ?? callbackUrl;
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="card-premium p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>

          <h1 className="font-heading text-2xl font-bold text-text-primary text-center mb-1">
            เข้าสู่ระบบ
          </h1>
          <p className="text-text-muted text-sm text-center mb-6">
            ยินดีต้อนรับกลับ — เข้าสู่ระบบเพื่อจัดการ Zudobot ของคุณ
          </p>

          {/* Auth / form errors */}
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
                กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </>
            )}
          </button>

          {/* Password login toggle */}
          {!showPassword ? (
            <button
              onClick={() => setShowPassword(true)}
              className="w-full text-center text-sm text-brand-600 hover:underline mt-4"
            >
              เข้าสู่ระบบด้วยรหัสผ่านแทน
            </button>
          ) : (
            <form onSubmit={handlePasswordLogin} className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowPassword(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  ← กลับไปใช้ Google
                </button>
                <Link href="/forgot-password" className="text-brand-600 hover:underline">
                  ลืมรหัสผ่าน?
                </Link>
              </div>
            </form>
          )}

          {/* Register link */}
          <p className="text-center text-sm text-text-muted mt-5">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-brand-600 font-medium hover:underline">
              สมัครใช้งานฟรี 14 วัน
            </Link>
          </p>
        </div>

        {/* PDPA note */}
        <p className="text-center text-xs text-text-muted mt-4">
          การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
          <Link href="/terms" className="underline">ข้อตกลง</Link>{" "}
          และ{" "}
          <Link href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
