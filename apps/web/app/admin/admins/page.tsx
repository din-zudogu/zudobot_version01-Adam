"use client";

import { useState, useEffect } from "react";
import type { KycStatus } from "@/lib/db/models/KycSubmission";

interface KycRecord {
  _id:          string;
  tenantId:     string;
  tenantEmail?: string;
  tenantName?:  string;
  legalName:    string;
  taxId:        string;
  vatRegistered:boolean;
  address:      string;
  province:     string;
  contactName:  string;
  contactPhone: string;
  status:       KycStatus;
  reviewNote?:  string;
  createdAt:    string;
}

const STATUS_COLORS: Record<KycStatus, string> = {
  pending:           "bg-yellow-100 text-yellow-700",
  approved:          "bg-green-100 text-green-700",
  rejected:          "bg-red-100 text-red-700",
  more_info_needed:  "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<KycStatus, string> = {
  pending:          "รอตรวจสอบ",
  approved:         "อนุมัติแล้ว",
  rejected:         "ปฏิเสธ",
  more_info_needed: "ต้องการข้อมูลเพิ่ม",
};

function ReviewModal({ kyc, onAction, onClose }: {
  kyc: KycRecord;
  onAction: (id: string, status: KycStatus, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote]     = useState(kyc.reviewNote ?? "");
  const [saving, setSaving] = useState(false);

  async function act(status: KycStatus) {
    setSaving(true);
    await onAction(kyc._id, status, note);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-text-primary">KYC Review</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">×</button>
        </div>

        <div className="space-y-2 text-sm mb-4">
          {[
            ["Tenant", `${kyc.tenantName} (${kyc.tenantEmail})`],
            ["ชื่อนิติบุคคล", kyc.legalName],
            ["เลขผู้เสียภาษี", kyc.taxId],
            ["จดทะเบียน VAT", kyc.vatRegistered ? "ใช่" : "ไม่ใช่"],
            ["ที่อยู่", `${kyc.address} ${kyc.province}`],
            ["ผู้ติดต่อ", `${kyc.contactName} / ${kyc.contactPhone}`],
          ].map(([label, val]) => (
            <div key={label} className="flex gap-3">
              <span className="w-36 flex-shrink-0 text-text-muted text-xs font-medium pt-0.5">{label}</span>
              <span className="text-text-primary">{val}</span>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-text-secondary mb-1">หมายเหตุ (ถ้ามี)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none"
            placeholder="เหตุผลในการปฏิเสธ หรือข้อมูลที่ต้องการเพิ่มเติม..."
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary transition-colors">
            ปิด
          </button>
          <button
            onClick={() => void act("more_info_needed")}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-orange-100 text-orange-700 text-sm font-medium hover:bg-orange-200 disabled:opacity-50 transition-colors"
          >
            ขอข้อมูลเพิ่ม
          </button>
          <button
            onClick={() => void act("rejected")}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            ปฏิเสธ
          </button>
          <button
            onClick={() => void act("approved")}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "กำลังบันทึก..." : "อนุมัติ ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminKycPage() {
  const [kycs, setKycs]         = useState<KycRecord[]>([]);
  const [total, setTotal]       = useState(0);
  const [statusFilter, setStatus] = useState<string>("pending");
  const [reviewing, setReviewing] = useState<KycRecord | null>(null);
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    const res  = await fetch(`/api/admin/kyc?status=${statusFilter}`);
    const data = await res.json();
    setKycs(data.kycs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [statusFilter]);

  async function handleAction(id: string, status: KycStatus, note: string) {
    await fetch(`/api/admin/kyc/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: note }),
    });
    setReviewing(null);
    void load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">KYC Review</h1>
          <p className="text-sm text-text-muted mt-0.5">ตรวจสอบและอนุมัติข้อมูลธุรกิจของ Tenant</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-surface-primary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
        >
          {(["all","pending","approved","rejected","more_info_needed"] as const).map((s) => (
            <option key={s} value={s}>{s === "all" ? "ทั้งหมด" : STATUS_LABELS[s as KycStatus] ?? s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : kycs.length === 0 ? (
        <div className="text-center py-20 text-text-muted text-sm">ไม่มีรายการ KYC ในสถานะนี้</div>
      ) : (
        <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                {["Tenant","ชื่อนิติบุคคล","เลขภาษี","สถานะ","ยื่นเมื่อ",""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kycs.map((k) => (
                <tr key={k._id} className="border-b border-border-default last:border-0 hover:bg-surface-secondary/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{k.tenantName}</p>
                    <p className="text-xs text-text-muted">{k.tenantEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{k.legalName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{k.taxId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[k.status]}`}>
                      {STATUS_LABELS[k.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                    {new Date(k.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setReviewing(k)}
                      className="text-xs text-brand-600 hover:underline font-medium"
                    >
                      ตรวจสอบ →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border-default text-xs text-text-muted">
            {total} รายการทั้งหมด
          </div>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          kyc={reviewing}
          onAction={handleAction}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
