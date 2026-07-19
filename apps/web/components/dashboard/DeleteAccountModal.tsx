"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type Step = "confirm" | "choose";

interface Props {
  onClose: () => void;
}

export function DeleteAccountModal({ onClose }: Props) {
  const [step, setStep]         = useState<Step>("confirm");
  const [confirmText, setText]  = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const confirmValid = confirmText.trim().toLowerCase() === "delete";

  async function handleProceed() {
    if (!confirmValid) return;
    setStep("choose");
  }

  async function handleDelete(type: "soft" | "hard") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");

      if (type === "hard") {
        // Hard delete: session is gone — redirect to landing page
        await signOut({ callbackUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com" });
      } else {
        // Soft delete: refresh session so JWT picks up pendingDeleteAt, then middleware handles routing
        window.location.href = "/account-pending-delete";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(13,24,41,0.6)", backdropFilter: "blur(4px)" }}
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="card-premium w-full max-w-sm p-7 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Step 1: Confirmation input ───────────────────────────── */}
        {step === "confirm" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-3xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="font-heading text-xl font-bold text-text-primary text-center mb-2">
              ลบบัญชี Zudobot
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed text-center mb-6">
              การดำเนินการนี้ไม่สามารถยกเลิกได้ง่ายๆ<br />
              กรุณาพิมพ์คำว่า <span className="font-semibold text-red-600">Delete</span> เพื่อยืนยัน
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์ Delete"
              autoFocus
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 transition-colors mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleProceed}
                disabled={!confirmValid}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ตกลง →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Deletion type choice ─────────────────────────── */}
        {step === "choose" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="font-heading text-xl font-bold text-text-primary text-center mb-2">
              เลือกประเภทการลบ
            </h3>
            <p className="text-sm text-text-secondary text-center mb-6">
              ต้องการลบข้อมูลแบบใด?
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Option A — soft delete */}
              <button
                onClick={() => handleDelete("soft")}
                disabled={loading}
                className="w-full text-left p-4 rounded-xl border-2 border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-colors disabled:opacity-50 group"
              >
                <p className="text-sm font-bold text-orange-800 mb-1">
                  ลบออกชั่วคราว
                </p>
                <p className="text-xs text-orange-700 leading-relaxed">
                  เก็บข้อมูลไว้ 90 วันก่อนลบถาวร — สามารถกู้คืนบัญชีได้ภายในระยะเวลาดังกล่าว
                </p>
              </button>

              {/* Option B — hard delete */}
              <button
                onClick={() => handleDelete("hard")}
                disabled={loading}
                className="w-full text-left p-4 rounded-xl border-2 border-red-300 bg-red-50 hover:border-red-500 hover:bg-red-100 transition-colors disabled:opacity-50 group"
              >
                <p className="text-sm font-bold text-red-700 mb-1">
                  ลบถาวรทันที
                </p>
                <p className="text-xs text-red-600 leading-relaxed">
                  ข้อมูลทั้งหมดจะสูญหายถาวร กู้คืนไม่ได้ และยกเลิก Subscription ทันที
                </p>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-5 text-sm text-text-muted">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                กำลังดำเนินการ...
              </div>
            )}

            {!loading && (
              <button
                onClick={() => setStep("confirm")}
                className="w-full mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                ← ย้อนกลับ
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
