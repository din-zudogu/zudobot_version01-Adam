"use client";

import { useState, useEffect, useCallback } from "react";

interface Config {
  promptpayId: string | null;
  promptpayEnabled: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankTransferEnabled: boolean;
}

interface Transaction {
  id: string;
  amountThb: number;
  method: "promptpay" | "bank_transfer";
  status: "auto_verified" | "pending_review" | "confirmed" | "rejected";
  confidence: number | null;
  extractedBankName: string | null;
  extractedRef: string | null;
  extractedDateTime: string | null;
  createdAt: string;
  slipUrl: string | null;
}

const STATUS_LABEL: Record<Transaction["status"], string> = {
  auto_verified: "ยืนยันอัตโนมัติ (AI มั่นใจสูง)",
  pending_review: "รอร้านค้าตรวจสอบ",
  confirmed: "ยืนยันรับชำระแล้ว",
  rejected: "ปฏิเสธ (ไม่ใช่การชำระเงินจริง)",
};

const STATUS_STYLE: Record<Transaction["status"], string> = {
  auto_verified: "bg-green-100 text-green-700",
  pending_review: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PaymentMethodsPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [promptpayId, setPromptpayId] = useState("");
  const [promptpayEnabled, setPromptpayEnabled] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankTransferEnabled, setBankTransferEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/tenant/payment-methods").then((r) => r.json()),
      fetch("/api/tenant/payment-methods/transactions").then((r) => r.json()),
    ]).then(([cfgData, txData]) => {
      const c: Config | null = cfgData.config ?? null;
      setQrDataUrl(cfgData.qrDataUrl ?? null);
      setPromptpayId(c?.promptpayId ?? "");
      setPromptpayEnabled(c?.promptpayEnabled ?? false);
      setBankName(c?.bankName ?? "");
      setBankAccountNumber(c?.bankAccountNumber ?? "");
      setBankAccountName(c?.bankAccountName ?? "");
      setBankTransferEnabled(c?.bankTransferEnabled ?? false);
      setTransactions(txData.transactions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaveError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/tenant/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptpayId, promptpayEnabled,
          bankName, bankAccountNumber, bankAccountName, bankTransferEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          invalid_promptpay_id: "หมายเลข PromptPay ไม่ถูกต้อง (ใช้เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก)",
          missing_bank_details: "กรุณากรอกข้อมูลบัญชีธนาคารให้ครบ",
        };
        throw new Error(msgs[data.error] ?? "บันทึกไม่สำเร็จ");
      }
      setSaved(true);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function review(id: string, decision: "confirmed" | "rejected") {
    setReviewingId(id);
    try {
      await fetch(`/api/tenant/payment-methods/transactions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      load();
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">ช่องทางรับชำระเงิน</h1>
        <p className="text-sm text-text-muted mt-0.5">
          ตั้งค่า PromptPay QR / บัญชีธนาคารสำหรับรับชำระจากลูกค้าของคุณ — เมื่อลูกค้าแนบสลิปในแชท ระบบจะตรวจสอบด้วย AI และบันทึกยอดรับชำระให้อัตโนมัติ
        </p>
      </div>

      {/* PromptPay */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-text-primary">PromptPay QR Code</p>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={promptpayEnabled} onChange={(e) => setPromptpayEnabled(e.target.checked)} />
            เปิดใช้งาน
          </label>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">หมายเลข PromptPay (เบอร์มือถือ หรือ เลขบัตรประชาชน)</label>
            <input
              type="text"
              value={promptpayId}
              onChange={(e) => setPromptpayId(e.target.value)}
              placeholder="0812345678"
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
            />
          </div>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="PromptPay QR" className="w-28 h-28 rounded-xl border border-border-default" />
          )}
        </div>
      </div>

      {/* Bank transfer */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-text-primary">โอนเงินด้วยบัญชีธนาคาร</p>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={bankTransferEnabled} onChange={(e) => setBankTransferEnabled(e.target.checked)} />
            เปิดใช้งาน
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">ธนาคาร</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">เลขที่บัญชี</label>
            <input type="text" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">ชื่อบัญชี</label>
            <input type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400" />
          </div>
        </div>
      </div>

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-green-600 font-medium">✓ บันทึกแล้ว</span>}
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {/* Transactions */}
      <div className="space-y-3">
        <p className="text-sm font-bold text-text-primary">รายการรับชำระ ({transactions.length})</p>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm bg-surface-primary rounded-2xl border border-border-default">
            ยังไม่มีรายการรับชำระ
          </div>
        ) : (
          <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  {["วันที่", "ช่องทาง", "ยอดเงิน", "สถานะ", "สลิป", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3 text-xs text-text-secondary">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{t.method === "promptpay" ? "PromptPay" : "โอนธนาคาร"}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">฿{t.amountThb.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.slipUrl ? (
                        <a href={t.slipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline font-medium">
                          ดูสลิป →
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.status === "pending_review" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => review(t.id, "confirmed")}
                            disabled={reviewingId === t.id}
                            className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            ยืนยัน
                          </button>
                          <button
                            onClick={() => review(t.id, "rejected")}
                            disabled={reviewingId === t.id}
                            className="px-2.5 py-1 rounded-lg bg-surface-secondary border border-border-default text-text-secondary text-xs font-semibold disabled:opacity-50"
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
