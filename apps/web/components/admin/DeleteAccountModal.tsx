"use client";

/**
 * DeleteAccountModal — reusable 2-step admin delete modal.
 *
 * Step 1: Admin types "Delete" (case-insensitive) to unlock confirm.
 * Step 2: Admin chooses soft delete (90-day pending) or hard delete (immediate cascade).
 *
 * The component makes the API call itself:
 *   tenant  → PATCH /api/admin/tenants/{id}  { action: "soft_delete" | "hard_delete" }
 *   partner → PATCH /api/admin/partners/{id} { action: "soft_delete" | "hard_delete" }
 *
 * onSuccess(type) is called after a successful deletion so the parent can
 * refresh its list and show a toast.
 */
import { useState } from "react";

export interface DeleteTarget {
  id:    string;
  name:  string;
  email: string;
  type:  "tenant" | "partner";
}

interface Props {
  target:    DeleteTarget;
  onClose:   () => void;
  onSuccess: (type: "soft" | "hard") => void;
}

const API_BASE: Record<DeleteTarget["type"], string> = {
  tenant:  "/api/admin/tenants",
  partner: "/api/admin/partners",
};

const SOFT_LABEL: Record<DeleteTarget["type"], { title: string; desc: string }> = {
  tenant:  {
    title: "ระงับและลบออกชั่วคราว (90 วัน)",
    desc:  "ปิดบอทและบัญชีทันที เก็บข้อมูลไว้ 90 วัน — กู้คืนได้ก่อนครบกำหนด",
  },
  partner: {
    title: "ระงับและลบออกชั่วคราว (90 วัน)",
    desc:  "ระงับสิทธิ์ Partner Dashboard ทันที เก็บข้อมูลไว้ 90 วัน — กู้คืนได้ก่อนครบกำหนด",
  },
};

const HARD_LABEL: Record<DeleteTarget["type"], { title: string; desc: string }> = {
  tenant:  {
    title: "ลบถาวรทันที",
    desc:  "ลบข้อมูลทั้งหมดและยกเลิก Subscription ทันที — กู้คืนไม่ได้",
  },
  partner: {
    title: "ลบถาวรทันที",
    desc:  "ลบ Partner Profile ทั้งหมด ปลดความสัมพันธ์กับ Tenant ในสังกัด — กู้คืนไม่ได้",
  },
};

export function DeleteAccountModal({ target, onClose, onSuccess }: Props) {
  const [step,         setStep]        = useState<"confirm" | "choose">("confirm");
  const [confirmText,  setConfirmText] = useState("");
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState("");

  const confirmValid = confirmText.trim().toLowerCase() === "delete";

  async function runDelete(action: "soft_delete" | "hard_delete") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE[target.type]}/${target.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      onSuccess(action === "soft_delete" ? "soft" : "hard");
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
        className="bg-surface-primary rounded-2xl shadow-2xl w-full max-w-sm p-7 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Step 1: Type "Delete" to confirm ──────────────────────────────── */}
        {step === "confirm" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-3xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="font-heading text-xl font-bold text-text-primary text-center mb-1">
              ลบบัญชี {target.type === "partner" ? "Partner" : "Tenant"}
            </h3>
            <p className="text-sm font-medium text-text-primary text-center break-all mb-0.5">
              {target.name}
            </p>
            <p className="text-xs text-text-muted text-center break-all mb-5">
              {target.email}
            </p>

            <p className="text-sm text-text-secondary text-center mb-4 leading-relaxed">
              พิมพ์คำว่า <span className="font-semibold text-red-600">Delete</span> เพื่อยืนยัน
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
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
                onClick={() => setStep("choose")}
                disabled={!confirmValid}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ตกลง →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Choose deletion type ──────────────────────────────────── */}
        {step === "choose" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="font-heading text-xl font-bold text-text-primary text-center mb-1">
              เลือกประเภทการลบ
            </h3>
            <p className="text-sm font-medium text-text-primary text-center break-all mb-0.5">
              {target.name}
            </p>
            <p className="text-xs text-text-muted text-center break-all mb-5">
              {target.email}
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Option A — Soft delete */}
              <button
                onClick={() => runDelete("soft_delete")}
                disabled={loading}
                className="w-full text-left p-4 rounded-xl border-2 border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-bold text-orange-800 mb-1">
                  {SOFT_LABEL[target.type].title}
                </p>
                <p className="text-xs text-orange-700 leading-relaxed">
                  {SOFT_LABEL[target.type].desc}
                </p>
              </button>

              {/* Option B — Hard delete */}
              <button
                onClick={() => runDelete("hard_delete")}
                disabled={loading}
                className="w-full text-left p-4 rounded-xl border-2 border-red-300 bg-red-50 hover:border-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-bold text-red-700 mb-1">
                  {HARD_LABEL[target.type].title}
                </p>
                <p className="text-xs text-red-600 leading-relaxed">
                  {HARD_LABEL[target.type].desc}
                </p>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-5 text-sm text-text-muted">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                กำลังดำเนินการ…
              </div>
            )}

            {!loading && (
              <button
                onClick={() => { setStep("confirm"); setError(""); }}
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
