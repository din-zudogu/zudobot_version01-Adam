"use client";

import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  tenantId: string;
  shopName: string;
  amountThb: number;
  method: "promptpay" | "bank_transfer";
  status: "auto_verified" | "pending_review" | "confirmed" | "rejected";
  confidence: number | null;
  createdAt: string;
}

const STATUS_STYLE: Record<Transaction["status"], string> = {
  auto_verified: "bg-green-100 text-green-700",
  pending_review: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<Transaction["status"], string> = {
  auto_verified: "ยืนยันอัตโนมัติ",
  pending_review: "รอตรวจสอบ",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
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

export default function AdminPaymentTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/payment-transactions")
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .catch(() => setTransactions([]));
  }, []);

  if (!transactions) return <Spinner />;

  const filtered = search.trim()
    ? transactions.filter((t) => t.shopName.toLowerCase().includes(search.toLowerCase()))
    : transactions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">รายการรับชำระเงินของร้านค้า</h1>
        <p className="text-sm text-text-muted mt-0.5">รวมทุกร้านค้าที่เปิดใช้ช่องทางรับชำระ PromptPay / โอนธนาคาร</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อร้านค้า..."
        className="w-full max-w-xs bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm bg-surface-primary rounded-2xl border border-border-default">
          ไม่มีรายการ
        </div>
      ) : (
        <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                {["ร้านค้า", "วันที่", "ช่องทาง", "ยอดเงิน", "ความมั่นใจของ AI", "สถานะ"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">{t.shopName}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">{t.method === "promptpay" ? "PromptPay" : "โอนธนาคาร"}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">฿{t.amountThb.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">{t.confidence != null ? `${Math.round(t.confidence * 100)}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
