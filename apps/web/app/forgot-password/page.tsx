"use client";

import { useState } from "react";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError("คำขอมากเกินไป กรุณาลองใหม่ภายหลัง");
      } else {
        setSent(true);
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        <div className="card-premium p-8">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-text-primary text-center mb-1">
            ลืมรหัสผ่าน
          </h1>
          <p className="text-text-muted text-sm text-center mb-6">
            กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ทางอีเมล
          </p>

          {sent ? (
            <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 whitespace-pre-wrap break-words">
              หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
              </button>
            </form>
          )}

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
