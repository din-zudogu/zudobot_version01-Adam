"use client";

import { useState } from "react";

type Step = "idle" | "confirm1" | "confirm2" | "deleting" | "done" | "error";

export default function PrivacyPage() {
  const [deleteStep, setDeleteStep]     = useState<Step>("idle");
  const [deleteCount, setDeleteCount]   = useState<number | null>(null);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [exporting, setExporting]       = useState(false);
  const [exportError, setExportError]   = useState<string | null>(null);

  // ── Export ──────────────────────────────────────────────────────

  async function handleExport(format: "json" | "csv") {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/tenant/gdpr/export?format=${format}`);
      if (!res.ok) throw new Error("export_failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `zudobot-data-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("ไม่สามารถ Export ข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setExporting(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleteStep("deleting");
    setDeleteError(null);
    try {
      const res = await fetch("/api/tenant/gdpr/delete", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ confirm: "DELETE_ALL_DATA" }),
      });
      const data = await res.json() as { ok?: boolean; deletedSessions?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "delete_failed");
      setDeleteCount(data.deletedSessions ?? 0);
      setDeleteStep("done");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      setDeleteStep("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">ความเป็นส่วนตัว & GDPR</h1>
        <p className="text-sm text-text-muted mt-0.5">จัดการข้อมูลส่วนตัวของลูกค้าตามสิทธิ์ PDPA / GDPR</p>
      </div>

      {/* Export Section */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-sm font-bold text-text-primary">ส่งออกข้อมูล (Right of Access)</p>
          <p className="text-xs text-text-muted mt-1">
            Export ประวัติการสนทนาทั้งหมดในรูป JSON หรือ CSV
            เพื่อตอบสนองคำขอ Data Subject Request ภายใน 30 วัน
          </p>
        </div>
        {exportError && <p className="text-sm text-red-500">{exportError}</p>}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {exporting ? "กำลัง Export..." : "Export JSON"}
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="px-5 py-2.5 rounded-xl bg-surface-secondary border border-border-default hover:border-brand-400 text-text-secondary hover:text-brand-600 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {exporting ? "กำลัง Export..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Delete Section */}
      <div className="bg-surface-primary border border-red-200 rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-sm font-bold text-red-700">ลบข้อมูลทั้งหมด (Right to Erasure)</p>
          <p className="text-xs text-text-muted mt-1">
            ลบประวัติการสนทนาทั้งหมดของลูกค้าออกจากระบบอย่างถาวร
            ตามสิทธิ์ GDPR Article 17 / PDPA
          </p>
          <p className="text-xs text-red-500 mt-1 font-medium">
            ⚠️ ไม่สามารถยกเลิกได้ — ข้อมูลจะถูกลบถาวร
          </p>
        </div>

        {deleteStep === "idle" && (
          <button
            onClick={() => setDeleteStep("confirm1")}
            className="px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-sm font-semibold transition-colors"
          >
            ลบข้อมูลทั้งหมด
          </button>
        )}

        {deleteStep === "confirm1" && (
          <div className="space-y-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm font-semibold text-red-800">ขั้นตอนที่ 1/2 — ยืนยันการลบ</p>
            <p className="text-xs text-red-700">
              การกระทำนี้จะลบประวัติการสนทนาของลูกค้าทั้งหมดอย่างถาวร
              ข้อมูลจะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteStep("confirm2")}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                ใช่ ฉันแน่ใจ
              </button>
              <button
                onClick={() => setDeleteStep("idle")}
                className="px-4 py-2 rounded-xl bg-surface-secondary border border-border-default text-text-secondary text-sm font-semibold hover:border-border-strong transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {deleteStep === "confirm2" && (
          <div className="space-y-3 p-4 bg-red-100 rounded-xl border border-red-300">
            <p className="text-sm font-bold text-red-900">ขั้นตอนที่ 2/2 — ยืนยันครั้งสุดท้าย</p>
            <p className="text-xs text-red-800">
              กด &quot;ยืนยันลบถาวร&quot; เพื่อดำเนินการ — ไม่สามารถยกเลิกได้หลังจากนี้
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800 transition-colors"
              >
                ยืนยันลบถาวร
              </button>
              <button
                onClick={() => setDeleteStep("idle")}
                className="px-4 py-2 rounded-xl bg-surface-secondary border border-border-default text-text-secondary text-sm font-semibold hover:border-border-strong transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {deleteStep === "deleting" && (
          <div className="flex items-center gap-3 text-sm text-red-700">
            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            กำลังลบข้อมูล...
          </div>
        )}

        {deleteStep === "done" && (
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <p className="text-sm font-semibold text-green-700">
              ✅ ลบสำเร็จ — {deleteCount} session ถูกลบออกจากระบบแล้ว
            </p>
          </div>
        )}

        {deleteStep === "error" && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
            <p className="text-sm text-red-700">{deleteError}</p>
            <button
              onClick={() => setDeleteStep("idle")}
              className="text-xs text-red-600 underline"
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>

      {/* Rights Info */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-3">
        <p className="text-sm font-bold text-text-primary">สิทธิ์ตาม PDPA / GDPR</p>
        <div className="space-y-2 text-xs text-text-secondary">
          {[
            ["สิทธิ์ในการเข้าถึงข้อมูล (Art. 15)", "Export JSON / CSV ด้านบน"],
            ["สิทธิ์ในการลบข้อมูล (Art. 17)", "ปุ่ม \"ลบข้อมูลทั้งหมด\" ด้านบน"],
            ["สิทธิ์ในการแก้ไขข้อมูล (Art. 16)", "ติดต่อ support@zudogu.com"],
            ["สิทธิ์ในการโอนย้ายข้อมูล (Art. 20)", "Export JSON แล้วนำไปใช้กับระบบอื่น"],
          ].map(([right, action]) => (
            <div key={right} className="flex justify-between gap-4 py-1.5 border-b border-border-default last:border-0">
              <span className="font-medium text-text-primary">{right}</span>
              <span className="text-right">{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
