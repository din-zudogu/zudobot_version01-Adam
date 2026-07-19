"use client";

import { useState, useEffect, useCallback } from "react";

type EntityType = "individual" | "corporate";

interface LegalProfile {
  entityType:          EntityType;
  fullNameInd:         string;
  nationalId:          string;
  addressResidence:    string;
  bankAccInd:          string;
  corporateName:       string;
  taxId:               string;
  addressOffice:       string;
  branchCode:          string;
  authorizedSignatory: string;
  bankAccCorp:         string;
  documentUrls:        string[];
  unmasked:            boolean;
}

const EMPTY: LegalProfile = {
  entityType:          "individual",
  fullNameInd:         "",
  nationalId:          "",
  addressResidence:    "",
  bankAccInd:          "",
  corporateName:       "",
  taxId:               "",
  addressOffice:       "",
  branchCode:          "",
  authorizedSignatory: "",
  bankAccCorp:         "",
  documentUrls:        [],
  unmasked:            false,
};

function Field({
  label, value, onChange, type = "text", required = false, placeholder = "",
  masked, onUnmask,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
  masked?: boolean; onUnmask?: () => void;
}) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2.5 rounded-xl border border-border-default text-sm focus:outline-none focus:border-brand-400 transition-colors bg-surface-secondary pr-9"
        />
        {masked && onUnmask && (
          <button
            type="button"
            onClick={onUnmask}
            title="แสดงข้อมูลจริง"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            👁
          </button>
        )}
      </div>
    </div>
  );
}

export default function PartnerProfilePage() {
  const [form,       setForm]       = useState<LegalProfile>(EMPTY);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [unmasking,  setUnmasking]  = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error,      setError]      = useState("");
  const [hasProfile, setHasProfile] = useState(false);

  const loadProfile = useCallback((unmask = false) => {
    fetch(`/api/partner/legal-profile${unmask ? "?unmask=1" : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) { setForm({ ...EMPTY, ...d.profile }); setHasProfile(true); }
        else            { setForm(EMPTY); setHasProfile(false); }
      })
      .finally(() => { setLoading(false); setUnmasking(false); });
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  function set<K extends keyof LegalProfile>(key: K, val: LegalProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      const res  = await fetch("/api/partner/legal-profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          entityType:          form.entityType,
          fullNameInd:         form.fullNameInd,
          nationalId:          form.nationalId,
          addressResidence:    form.addressResidence,
          bankAccInd:          form.bankAccInd,
          corporateName:       form.corporateName,
          taxId:               form.taxId,
          addressOffice:       form.addressOffice,
          branchCode:          form.branchCode,
          authorizedSignatory: form.authorizedSignatory,
          bankAccCorp:         form.bankAccCorp,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      loadProfile(); // reload masked values
    } catch {
      setError("Network error กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  function handleUnmask() {
    setUnmasking(true);
    loadProfile(true);
  }

  const isInd  = form.entityType === "individual";
  const isCorp = form.entityType === "corporate";

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Partner Profile</h1>
        <p className="text-sm text-text-muted mt-1">ข้อมูลทางกฎหมายและภาษีของพาร์ทเนอร์ — เก็บรักษาด้วยการเข้ารหัส AES-256</p>
      </div>

      {hasProfile && !form.unmasked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-amber-800">ข้อมูลสำคัญถูกซ่อนเพื่อความปลอดภัย</span>
          <button onClick={handleUnmask} disabled={unmasking}
            className="text-amber-700 font-semibold underline hover:no-underline text-xs disabled:opacity-60">
            {unmasking ? "กำลังแสดง…" : "👁 แสดงข้อมูลจริง"}
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{successMsg}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Entity type toggle */}
        <div className="bg-surface-primary rounded-2xl border border-border-default p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">ประเภทพาร์ทเนอร์</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["individual", "corporate"] as EntityType[]).map((type) => (
              <label key={type} className={["flex items-center gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all",
                form.entityType === type ? "border-brand-500 bg-brand-50" : "border-border-default bg-surface-secondary hover:border-brand-300",
              ].join(" ")}>
                <input type="radio" name="entityType" value={type} checked={form.entityType === type}
                  onChange={() => set("entityType", type)} className="accent-brand-600" />
                <span className="text-sm font-medium text-text-primary">
                  {type === "individual" ? "👤 บุคคลธรรมดา" : "🏢 นิติบุคคล"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Individual fields */}
        {isInd && (
          <div className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">ข้อมูลบุคคลธรรมดา</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ชื่อ-นามสกุล" value={form.fullNameInd} onChange={(v) => set("fullNameInd", v)}
                required placeholder="สมชาย ใจดี" />
              <Field label="เลขบัตรประชาชน (13 หลัก)" value={form.nationalId} onChange={(v) => set("nationalId", v)}
                required placeholder="1-XXXX-XXXXX-XX-X"
                masked={hasProfile && !form.unmasked} onUnmask={handleUnmask} />
            </div>
            <Field label="ที่อยู่ตามทะเบียนบ้าน" value={form.addressResidence} onChange={(v) => set("addressResidence", v)}
              required placeholder="123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110" />
            <Field label="เลขบัญชีธนาคาร" value={form.bankAccInd} onChange={(v) => set("bankAccInd", v)}
              required placeholder="xxx-x-xxxxx-x"
              masked={hasProfile && !form.unmasked} onUnmask={handleUnmask} />
          </div>
        )}

        {/* Corporate fields */}
        {isCorp && (
          <div className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">ข้อมูลนิติบุคคล</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ชื่อนิติบุคคล" value={form.corporateName} onChange={(v) => set("corporateName", v)}
                required placeholder="บริษัท ตัวอย่าง จำกัด" />
              <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" value={form.taxId} onChange={(v) => set("taxId", v)}
                required placeholder="X-XXXX-XXXXX-XX-X"
                masked={hasProfile && !form.unmasked} onUnmask={handleUnmask} />
            </div>
            <Field label="ที่อยู่สำนักงานใหญ่" value={form.addressOffice} onChange={(v) => set("addressOffice", v)}
              required placeholder="123 ถ.สีลม แขวงสีลม เขตบางรัก กรุงเทพฯ 10500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="รหัสสาขา (ถ้ามี)" value={form.branchCode} onChange={(v) => set("branchCode", v)}
                placeholder="00000 (สำนักงานใหญ่)" />
              <Field label="ผู้มีอำนาจลงนาม" value={form.authorizedSignatory} onChange={(v) => set("authorizedSignatory", v)}
                required placeholder="นาย สมศักดิ์ ดีใจ" />
            </div>
            <Field label="เลขบัญชีธนาคารบริษัท" value={form.bankAccCorp} onChange={(v) => set("bankAccCorp", v)}
              required placeholder="xxx-x-xxxxx-x"
              masked={hasProfile && !form.unmasked} onUnmask={handleUnmask} />
          </div>
        )}

        {/* Document upload placeholder */}
        <div className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">เอกสารหลักฐาน</h2>
          <p className="text-xs text-text-muted">รองรับ PDF, PNG, JPG ขนาดไม่เกิน 5MB</p>
          {form.documentUrls.length > 0 ? (
            <ul className="space-y-1">
              {form.documentUrls.map((url, i) => (
                <li key={i} className="text-xs text-brand-600 underline">
                  <a href={url} target="_blank" rel="noopener noreferrer">เอกสาร {i + 1}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted italic">ยังไม่มีเอกสาร</p>
          )}
          <div className="border-2 border-dashed border-border-default rounded-xl p-6 text-center text-sm text-text-muted">
            ลากไฟล์มาวางที่นี่ หรือ{" "}
            <span className="text-brand-600 underline cursor-pointer">เลือกไฟล์</span>
            <p className="text-xs mt-1">(อัปโหลดเอกสารผ่าน Partner Support ในขณะนี้)</p>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </button>
      </form>

      <p className="text-center text-xs text-text-muted">
        🔒 ข้อมูลส่วนบุคคลทั้งหมดถูกเข้ารหัสด้วย AES-256-GCM ก่อนบันทึกลงฐานข้อมูล
      </p>
    </div>
  );
}
