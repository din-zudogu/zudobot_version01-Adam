"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "invalid_or_expired_token"
            ? "ลิงก์นี้หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่"
            : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
        );
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        ลิงก์นี้ไม่ถูกต้อง กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
        ตั้งรหัสผ่านใหม่สำเร็จ — กำลังพากลับไปหน้าเข้าสู่ระบบ...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap break-words">
          {error}
        </div>
      )}
      <input
        value={email}
        readOnly
        className="w-full bg-surface-tertiary border border-border-default rounded-xl px-4 py-3 text-sm text-text-muted cursor-not-allowed"
      />
      <input
        type="password"
        required
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
        className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
      />
      <input
        type="password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="ยืนยันรหัสผ่านใหม่"
        className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        <div className="card-premium p-8">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-text-primary text-center mb-1">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="text-text-muted text-sm text-center mb-6">
            กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
          </p>
          <Suspense fallback={<div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-text-muted mt-5">
            <Link href="/login" className="text-brand-600 font-medium hover:underline">
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
