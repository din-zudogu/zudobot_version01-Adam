"use client";

import { useState } from "react";

type DryRunResult = {
  found:      boolean;
  targetEmail?: string;
  role?:       string;
  totalDocs?:  number;
  counts?:     Record<string, number>;
  message?:    string;
};

export default function AdminDeleteAccountPage() {
  const [email,   setEmail]   = useState("work.luesat.d@gmail.com");
  const [step,    setStep]    = useState<"idle" | "dry" | "confirm" | "done">("idle");
  const [loading, setLoading] = useState(false);
  const [dryData, setDryData] = useState<DryRunResult | null>(null);
  const [result,  setResult]  = useState<string>("");
  const [error,   setError]   = useState("");

  async function runDry() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/delete-account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), confirm: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      setDryData(data);
      setStep("dry");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function runHardDelete() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/delete-account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      setResult(
        data.found === false
          ? `ไม่พบ ${email} ในระบบ — อาจถูกลบไปแล้ว`
          : `ลบ ${email} ออกจากระบบเรียบร้อย (${data.totalDocs ?? "?"} documents)`
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("idle");
    setDryData(null);
    setResult("");
    setError("");
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Delete Account (Permanent)</h1>
        <p className="text-xs text-text-muted mt-1">
          ลบข้อมูลทั้งหมดของ account ออกจากระบบถาวร ไม่ว่า role ใด — กู้คืนไม่ได้
        </p>
      </div>

      {/* ── Step: idle ── */}
      {step === "idle" && (
        <div className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Email ที่ต้องการลบ
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-secondary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={runDry}
            disabled={loading || !email.trim()}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "กำลังตรวจสอบ…" : "ตรวจสอบข้อมูล (Dry Run)"}
          </button>
        </div>
      )}

      {/* ── Step: dry run result ── */}
      {step === "dry" && dryData && (
        <div className="space-y-4">
          {!dryData.found ? (
            <div className="bg-surface-primary rounded-2xl border border-border-default p-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-text-primary">ไม่พบ account นี้ในระบบ</p>
              <p className="text-sm text-text-muted mt-1">{email} อาจถูกลบไปแล้ว</p>
              <button onClick={reset} className="mt-4 text-sm text-brand-600 hover:underline">
                ลองอีกครั้ง
              </button>
            </div>
          ) : (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-bold text-red-800 text-sm">พบข้อมูลต่อไปนี้ — จะถูกลบถาวร</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      <span className="font-semibold">{dryData.targetEmail}</span>
                      {" "} · role: {dryData.role}
                      {" "} · {dryData.totalDocs} documents รวมทั้งหมด
                    </p>
                  </div>
                </div>

                {dryData.counts && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {Object.entries(dryData.counts)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between px-3 py-1.5 bg-white/60 rounded-lg text-xs">
                          <span className="text-red-700 font-medium">{k}</span>
                          <span className="text-red-800 font-bold">{v}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              {step === "dry" && (
                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                  >
                    ดำเนินการต่อ →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step: final confirm ── */}
      {step === "confirm" && (
        <div className="bg-surface-primary rounded-2xl border-2 border-red-300 p-6 space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="font-bold text-text-primary text-base">ยืนยันการลบถาวร</h2>
            <p className="text-sm text-text-muted mt-1 break-all">{email}</p>
            <p className="text-xs text-red-600 mt-2 font-medium">การกระทำนี้ไม่สามารถกู้คืนได้</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("dry")}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              ← ย้อนกลับ
            </button>
            <button
              onClick={runHardDelete}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังลบ…
                </span>
              ) : "ลบถาวรเลย"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: done ── */}
      {step === "done" && (
        <div className="bg-surface-primary rounded-2xl border border-green-200 p-6 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <p className="font-bold text-text-primary">{result}</p>
          <button
            onClick={reset}
            className="mt-2 px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            ลบ account อื่น
          </button>
        </div>
      )}
    </div>
  );
}
