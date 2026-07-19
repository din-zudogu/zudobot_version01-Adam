"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

export default function TwoFactorPage() {
  const router  = useRouter();
  const [code, setCode]       = useState(["", "", "", "", "", ""]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...code];
    next[idx]   = digit;
    setCode(next);
    setError(null);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    // Auto-submit when all 6 digits filled
    if (digit && idx === 5 && next.every(Boolean)) {
      submit(next.join(""));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter") {
      const full = code.join("");
      if (full.length === 6) submit(full);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      submit(pasted);
    }
    e.preventDefault();
  }

  async function submit(fullCode: string) {
    if (fullCode.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/verify-2fa", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: fullCode }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        const msgs: Record<string, string> = {
          invalid_code:      "รหัสไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่",
          code_required:     "กรุณากรอกรหัส 6 หลัก",
          "2fa_not_configured": "ยังไม่ได้ตั้งค่า 2FA กรุณาติดต่อ support",
        };
        setError(msgs[data.error ?? ""] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        setCode(["", "", "", "", "", ""]);
        setLoading(false);
        inputs.current[0]?.focus();
        return;
      }

      // Success — redirect to dashboard
      router.replace("/dashboard/overview");
    } catch {
      setError("เกิดข้อผิดพลาดของเครือข่าย กรุณาลองใหม่");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm">
        <div className="card-premium p-8 space-y-6">
          <div className="flex justify-center">
            <ZudobotLogo size="md" variant="color" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-heading text-xl font-bold text-text-primary">ยืนยันตัวตน 2 ขั้นตอน</h1>
            <p className="text-sm text-text-muted">
              กรอกรหัส 6 หลักจาก Authenticator App ของคุณ
            </p>
          </div>

          {/* 6-digit input boxes */}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={loading}
                className={[
                  "w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-colors",
                  "bg-surface-secondary text-text-primary",
                  digit
                    ? "border-brand-500"
                    : "border-border-default focus:border-brand-400",
                  loading ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              />
            ))}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          <button
            onClick={() => submit(code.join(""))}
            disabled={code.join("").length !== 6 || loading}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังตรวจสอบ...
              </span>
            ) : "ยืนยัน"}
          </button>

          <div className="text-center space-y-2">
            <p className="text-xs text-text-muted">
              รหัสจะรีเฟรชทุก 30 วินาที — ใช้ Google Authenticator, Authy หรือ App อื่นที่รองรับ TOTP
            </p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-text-muted hover:text-red-500 underline transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
