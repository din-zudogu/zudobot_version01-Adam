"use client";

import { useState, useEffect } from "react";

interface KycRecord {
  _id: string;
  status: "pending" | "approved" | "rejected" | "more_info_needed";
  legalName: string; taxId: string; vatRegistered: boolean;
  address: string; province: string; postalCode: string;
  contactName: string; contactPhone: string;
  reviewNote?: string; reviewedAt?: string; createdAt: string;
}

interface KycForm {
  legalName: string; taxId: string; vatRegistered: boolean;
  address: string; province: string; postalCode: string;
  contactName: string; contactPhone: string;
}

const EMPTY_FORM: KycForm = {
  legalName: "", taxId: "", vatRegistered: false,
  address: "", province: "", postalCode: "",
  contactName: "", contactPhone: "",
};

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function FieldInput({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text-primary mb-1">{label}</label>
      {hint && <p className="text-xs text-text-muted mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

export default function KycPage() {
  const [kyc, setKyc]         = useState<KycRecord | null | undefined>(undefined);
  const [form, setForm]       = useState<KycForm>(EMPTY_FORM);
  const [submitting, setSubm] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/kyc")
      .then((r) => r.json())
      .then((d) => setKyc(d.kyc ?? null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{13}$/.test(form.taxId)) {
      setError("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    setSubm(true);
    try {
      const res = await fetch("/api/tenant/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          missing_field_legalName:  "กรุณากรอกชื่อนิติบุคคล",
          missing_field_taxId:      "กรุณากรอกเลขผู้เสียภาษี",
          missing_field_address:    "กรุณากรอกที่อยู่",
          missing_field_province:   "กรุณากรอกจังหวัด",
          missing_field_postalCode: "กรุณากรอกรหัสไปรษณีย์",
          missing_field_contactName: "กรุณากรอกชื่อผู้ติดต่อ",
          missing_field_contactPhone:"กรุณากรอกเบอร์โทร",
          invalid_tax_id:           "เลขผู้เสียภาษีไม่ถูกต้อง",
          pending_submission_exists:"มีการยื่นที่รอตรวจสอบอยู่แล้ว",
        };
        throw new Error(msgs[data.error] ?? "ยื่นไม่สำเร็จ กรุณาลองใหม่");
      }
      setSuccess(true);
      setKyc({ ...form, _id: data.kycId, status: "pending", vatRegistered: form.vatRegistered, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยื่นไม่สำเร็จ");
    } finally {
      setSubm(false);
    }
  }

  if (kyc === undefined) return <Spinner />;

  // ── Approved ──
  if (kyc?.status === "approved") {
    return (
      <div className="max-w-xl">
        <h1 className="font-heading text-2xl font-bold text-text-primary mb-5">KYC</h1>
        <div className="bg-green-50 border border-green-300 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-green-800">ได้รับการอนุมัติแล้ว</p>
              <p className="text-sm text-green-700">บัญชีของคุณผ่านการตรวจสอบ KYC แล้ว</p>
            </div>
          </div>
          <div className="space-y-1.5 text-sm text-green-900">
            <p><span className="font-medium">ชื่อนิติบุคคล:</span> {kyc.legalName}</p>
            <p><span className="font-medium">เลขผู้เสียภาษี:</span> {kyc.taxId}</p>
            <p><span className="font-medium">จดทะเบียน VAT:</span> {kyc.vatRegistered ? "ใช่" : "ไม่ใช่"}</p>
            <p><span className="font-medium">ที่อยู่:</span> {kyc.address} {kyc.province} {kyc.postalCode}</p>
            <p><span className="font-medium">ผู้ติดต่อ:</span> {kyc.contactName} / {kyc.contactPhone}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending ──
  if (kyc?.status === "pending") {
    return (
      <div className="max-w-xl">
        <h1 className="font-heading text-2xl font-bold text-text-primary mb-5">KYC</h1>
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-amber-800">อยู่ระหว่างการตรวจสอบ</p>
              <p className="text-sm text-amber-700">ทีมงานจะตรวจสอบภายใน 1–3 วันทำการ</p>
            </div>
          </div>
          <p className="text-xs text-amber-700">ยื่นเมื่อ: {new Date(kyc.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>
    );
  }

  // ── Form (no KYC / rejected / more_info_needed) ──
  const adminNote = kyc?.status === "rejected" || kyc?.status === "more_info_needed" ? kyc.reviewNote : null;

  return (
    <div className="max-w-xl">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-text-primary">KYC Verification</h1>
        <p className="text-sm text-text-muted mt-0.5">ยื่นข้อมูลธุรกิจเพื่อรับสิทธิ์ Enterprise และออกใบกำกับภาษี</p>
      </div>

      {kyc?.status === "rejected" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl">
          <p className="text-sm font-semibold text-red-800">ถูกปฏิเสธ — กรุณายื่นใหม่</p>
          {adminNote && <p className="text-sm text-red-700 mt-1">{adminNote}</p>}
        </div>
      )}
      {kyc?.status === "more_info_needed" && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-300 rounded-xl">
          <p className="text-sm font-semibold text-orange-800">ต้องการข้อมูลเพิ่มเติม</p>
          {adminNote && <p className="text-sm text-orange-700 mt-1">{adminNote}</p>}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-xl text-sm text-green-800 font-medium">
          ✓ ยื่น KYC สำเร็จ — อยู่ระหว่างการตรวจสอบ
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">

        <FieldInput label="ชื่อนิติบุคคล / Legal Name" hint="ชื่อตามหนังสือรับรองบริษัท">
          <input type="text" value={form.legalName} onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))} required
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />
        </FieldInput>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="เลขประจำตัวผู้เสียภาษี" hint="13 หลัก">
            <input type="text" value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} required maxLength={13}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-400" />
          </FieldInput>
          <FieldInput label="จดทะเบียน VAT?">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.vatRegistered} onChange={(e) => setForm((p) => ({ ...p, vatRegistered: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
              <span className="text-sm text-text-secondary">ใช่ (VAT Registered)</span>
            </label>
          </FieldInput>
        </div>

        <FieldInput label="ที่อยู่จดทะเบียน">
          <textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required rows={2}
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none" />
        </FieldInput>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="จังหวัด">
            <input type="text" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))} required
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />
          </FieldInput>
          <FieldInput label="รหัสไปรษณีย์">
            <input type="text" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} required maxLength={5}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-400" />
          </FieldInput>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="ชื่อผู้ติดต่อ">
            <input type="text" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} required
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />
          </FieldInput>
          <FieldInput label="เบอร์โทร">
            <input type="tel" value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} required
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400" />
          </FieldInput>
        </div>

        <div className="pt-2 border-t border-border-default">
          <p className="text-xs text-text-muted mb-3">เอกสารประกอบ (URL ไฟล์จาก Google Drive / Dropbox) — ไม่บังคับ</p>
          {[
            { key: "docBusinessCert",   label: "หนังสือรับรองบริษัท" },
            { key: "docVatCert",        label: "ใบทะเบียน VAT (ถ้ามี)" },
            { key: "docSignedContract", label: "สัญญาที่ลงนาม (ถ้ามี)" },
          ].map(({ key, label }) => (
            <div key={key} className="mb-2">
              <label className="block text-xs text-text-secondary mb-1">{label}</label>
              <input type="url" placeholder="https://..."
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value || undefined }))}
                className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400" />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
        >
          {submitting ? "กำลังส่ง..." : "ยื่น KYC"}
        </button>
      </form>
    </div>
  );
}
