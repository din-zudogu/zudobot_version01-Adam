"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlatformSettings } from "@/types";

// ── Tab definition ────────────────────────────────────────────────
const TABS = [
  { id: "trial",       label: "A · Trial",           icon: "🎯" },
  { id: "quota",       label: "B · Quota",           icon: "📊" },
  { id: "grace",       label: "C · Payment Grace",   icon: "⏳" },
  { id: "bot",         label: "D · Bot Behavior",    icon: "🤖" },
  { id: "centralized", label: "E · Centralized Data",icon: "🗄" },
  { id: "sandbox",     label: "F · Sandbox",         icon: "🧪" },
  { id: "financial",   label: "G · Financial",       icon: "💰" },
  { id: "cdn",         label: "H · CDN & Widget",    icon: "🌐" },
  { id: "legal",       label: "I · Legal / PDPA",    icon: "⚖️" },
  { id: "tax",         label: "J · Tax & Invoice",   icon: "🧾" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ── Reusable field components ─────────────────────────────────────
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-5 gap-4 py-4 border-b border-border-default last:border-0">
      <div className="col-span-2">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="col-span-3">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full sm:w-36 bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
    />
  );
}

function TextInput({ value, onChange, mono }: { value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors",
        mono ? "font-mono" : "",
      ].join(" ")}
    />
  );
}

function TextareaInput({ value, onChange, rows }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows ?? 3}
      className="w-full bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors resize-y font-mono"
    />
  );
}

// ── Tab content components ────────────────────────────────────────
function TabTrial({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="ระยะเวลาทดลอง (วัน)" hint="Group A1">
        <NumberInput value={s.trialDurationDays} onChange={(v) => set("trialDurationDays", v)} min={1} max={90} />
      </FieldRow>
      <FieldRow label="โควต้าต่อวัน (Trial)" hint="Group A2 — ข้อความ/วัน">
        <NumberInput value={s.trialDailyQuotaCap} onChange={(v) => set("trialDailyQuotaCap", v)} min={1} />
      </FieldRow>
      <FieldRow label="ข้อความบอทเมื่อโควต้าหมด" hint="Group A3 — แสดงใน widget">
        <TextareaInput value={s.trialQuotaExhaustedBotMessage} onChange={(v) => set("trialQuotaExhaustedBotMessage", v)} />
      </FieldRow>
      <FieldRow label="หัวข้ออีเมล (โควต้าหมด)" hint="Group A4">
        <TextInput value={s.trialQuotaExhaustedEmailSubject} onChange={(v) => set("trialQuotaExhaustedEmailSubject", v)} />
      </FieldRow>
      <FieldRow label="เนื้อหาอีเมล (โควต้าหมด)" hint="Group A5">
        <TextareaInput value={s.trialQuotaExhaustedEmailBody} onChange={(v) => set("trialQuotaExhaustedEmailBody", v)} rows={4} />
      </FieldRow>
    </div>
  );
}

function TabQuota({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="เกณฑ์แจ้งเตือนโควต้า (%)" hint="Group B1 — เช่น [80, 95]">
        <TextInput
          value={s.quotaAlertThresholds.join(", ")}
          onChange={(v) => set("quotaAlertThresholds", v.split(",").map((x) => parseInt(x.trim(), 10)).filter(Boolean))}
          mono
        />
      </FieldRow>
      <FieldRow label="Grace Buffer (%)" hint="Group B2 — ช่วงผ่อนผันเกินโควต้า เช่น 5 = 5%">
        <NumberInput value={s.quotaGraceBufferPercent} onChange={(v) => set("quotaGraceBufferPercent", v)} min={0} max={20} />
      </FieldRow>
      <FieldRow label="ข้อความบอทเมื่อโควต้าหมด (Paid)" hint="Group B3">
        <TextareaInput value={s.quotaExhaustedBotMessage} onChange={(v) => set("quotaExhaustedBotMessage", v)} />
      </FieldRow>
    </div>
  );
}

function TabGrace({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="Grace Period (Non-Enterprise, วัน)" hint="Group C1 — ก่อนระงับเมื่อชำระล้าช้า">
        <NumberInput value={s.nonEnterpriseRenewalGraceDays} onChange={(v) => set("nonEnterpriseRenewalGraceDays", v)} min={1} max={30} />
      </FieldRow>
      <FieldRow label="Invoice Grace (Enterprise, วัน)" hint="Group C2 — ระยะเวลาชำระ Invoice">
        <NumberInput value={s.enterpriseInvoiceGraceDays} onChange={(v) => set("enterpriseInvoiceGraceDays", v)} min={1} max={60} />
      </FieldRow>
      <FieldRow label="แจ้งเตือน Invoice ล่วงหน้า (วัน)" hint="Group C3 — ส่งอีเมลก่อนครบกำหนด">
        <NumberInput value={s.enterpriseBillingAlertDays} onChange={(v) => set("enterpriseBillingAlertDays", v)} min={1} max={30} />
      </FieldRow>
    </div>
  );
}

function TabBot({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="Session Timeout (นาที)" hint="Group D1">
        <NumberInput value={s.sessionTimeoutMinutes} onChange={(v) => set("sessionTimeoutMinutes", v)} min={5} max={240} />
      </FieldRow>
      <FieldRow label="Minimum Engagement (วินาที)" hint="Group D2 — บอทพยายามสนทนาอย่างน้อย X วิ">
        <NumberInput value={s.minimumEngagementSeconds} onChange={(v) => set("minimumEngagementSeconds", v)} min={0} max={300} />
      </FieldRow>
      <FieldRow label="Amnesia Message Template" hint="Group D3 — แสดงเมื่อเกิน retention">
        <TextareaInput value={s.amnesiaMessageTemplate} onChange={(v) => set("amnesiaMessageTemplate", v)} />
      </FieldRow>
      <FieldRow label="เตือนก่อน Retention หมด (วัน)" hint="Group D4">
        <NumberInput value={s.retentionWarningDays} onChange={(v) => set("retentionWarningDays", v)} min={1} max={30} />
      </FieldRow>
      <FieldRow label="ข้อความเมื่อ Gemini ล่ม" hint="Group D5">
        <TextareaInput value={s.geminiDownMessage} onChange={(v) => set("geminiDownMessage", v)} />
      </FieldRow>
    </div>
  );
}

function TabCentralized({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="เก็บข้อมูล Centralized (ปี)" hint="Group E1">
        <NumberInput value={s.centralizedRetentionYears} onChange={(v) => set("centralizedRetentionYears", v)} min={1} max={10} />
      </FieldRow>
      <FieldRow label="วันที่ทำความสะอาด (ทุกเดือน)" hint="Group E2 — วันที่ 1–28">
        <NumberInput value={s.centralizedCleanupDayOfMonth} onChange={(v) => set("centralizedCleanupDayOfMonth", v)} min={1} max={28} />
      </FieldRow>
    </div>
  );
}

function TabSandbox({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="IP Rate Limit (ต่อชั่วโมง)" hint="Group F1">
        <NumberInput value={s.sandboxRateLimitPerHour} onChange={(v) => set("sandboxRateLimitPerHour", v)} min={1} max={200} />
      </FieldRow>
      <FieldRow label="ข้อความต่อ Session" hint="Group F2">
        <NumberInput value={s.sandboxAccountMessageLimit} onChange={(v) => set("sandboxAccountMessageLimit", v)} min={5} max={100} />
      </FieldRow>
      <FieldRow label="แสดง CTA หลังข้อความที่..." hint="Group F3">
        <NumberInput value={s.sandboxCtaTriggerAfterMessages} onChange={(v) => set("sandboxCtaTriggerAfterMessages", v)} min={1} max={20} />
      </FieldRow>
      <FieldRow label="CTA Message" hint="Group F4">
        <TextareaInput value={s.sandboxCtaMessage} onChange={(v) => set("sandboxCtaMessage", v)} />
      </FieldRow>
    </div>
  );
}

function TabFinancial({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="VAT Rate" hint="Group G1 — เช่น 0.07 = 7%">
        <NumberInput value={s.vatRate} onChange={(v) => set("vatRate", v)} min={0} max={0.3} step={0.01} />
      </FieldRow>
      <FieldRow label="Enterprise Cost-Plus Multiplier" hint="Group G2 — เช่น 1.30 = markup 30%">
        <NumberInput value={s.enterpriseCostPlusMultiplier} onChange={(v) => set("enterpriseCostPlusMultiplier", v)} min={1} max={3} step={0.05} />
      </FieldRow>
      <FieldRow label="WHT Rate" hint="Group G3 — เช่น 0.03 = 3%">
        <NumberInput value={s.whtRate} onChange={(v) => set("whtRate", v)} min={0} max={0.2} step={0.01} />
      </FieldRow>
    </div>
  );
}

function TabCdn({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="Widget CDN Base URL" hint="Group H1">
        <TextInput value={s.widgetCdnBaseUrl} onChange={(v) => set("widgetCdnBaseUrl", v)} mono />
      </FieldRow>
      <FieldRow label="Stable Version" hint="Group H2 — ผู้ใช้ใหม่ได้รับเวอร์ชันนี้">
        <TextInput value={s.widgetStableVersion} onChange={(v) => set("widgetStableVersion", v)} mono />
      </FieldRow>
      <FieldRow label="Latest Version" hint="Group H3 — เวอร์ชันล่าสุดสำหรับ beta">
        <TextInput value={s.widgetLatestVersion} onChange={(v) => set("widgetLatestVersion", v)} mono />
      </FieldRow>
      <div className="mt-4 p-3 rounded-xl bg-surface-secondary border border-border-default">
        <p className="text-xs text-text-muted font-mono">
          Widget URL: {s.widgetCdnBaseUrl}/widget.js?v={s.widgetStableVersion}
        </p>
      </div>
    </div>
  );
}

function BoolToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          "relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none",
          value ? "bg-brand-600" : "bg-surface-tertiary border border-border-default",
        ].join(" ")}
      >
        <span className={[
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
          value ? "translate-x-5" : "translate-x-0",
        ].join(" ")} />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

function TabTax({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      {/* Seller / Company Info */}
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 mt-1">ข้อมูลบริษัท (Seller)</p>
      <FieldRow label="ชื่อบริษัท / Seller Name" hint="J1 — แสดงบนทุกใบกำกับภาษีและใบเสร็จ">
        <TextInput value={s.invoiceSellerName} onChange={(v) => set("invoiceSellerName", v)} />
      </FieldRow>
      <FieldRow label="เลขประจำตัวผู้เสียภาษี" hint="J2 — 13 หลัก">
        <TextInput value={s.invoiceSellerTaxId} onChange={(v) => set("invoiceSellerTaxId", v)} mono />
      </FieldRow>
      <FieldRow label="ที่อยู่บริษัท" hint="J3 — แสดงบนใบกำกับภาษี">
        <TextareaInput value={s.invoiceSellerAddress} onChange={(v) => set("invoiceSellerAddress", v)} rows={2} />
      </FieldRow>
      <FieldRow label="โทรศัพท์" hint="J4">
        <TextInput value={s.invoiceSellerPhone} onChange={(v) => set("invoiceSellerPhone", v)} mono />
      </FieldRow>
      <FieldRow label="อีเมล Billing" hint="J5">
        <TextInput value={s.invoiceSellerEmail} onChange={(v) => set("invoiceSellerEmail", v)} mono />
      </FieldRow>
      <FieldRow label="จดทะเบียน VAT?" hint="J6 — ถ้าใช่จะออก ใบกำกับภาษี; ถ้าไม่จะออก ใบเสร็จรับเงิน">
        <BoolToggle
          value={s.invoiceSellerIsVatRegistered}
          onChange={(v) => set("invoiceSellerIsVatRegistered", v)}
          label={s.invoiceSellerIsVatRegistered ? "ออกใบกำกับภาษีแบบเต็ม" : "ออกใบเสร็จรับเงินอย่างเดียว"}
        />
      </FieldRow>

      {/* Invoice Number Format */}
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 mt-6">รูปแบบเลขที่ใบกำกับ</p>
      <FieldRow label="Invoice Prefix" hint="J7 — เช่น ZUD → ZUD-2026-000001">
        <TextInput value={s.invoiceNumberPrefix} onChange={(v) => set("invoiceNumberPrefix", v)} mono />
      </FieldRow>
      <div className="mb-1 mt-1 p-3 rounded-xl bg-surface-secondary border border-border-default">
        <p className="text-xs text-text-muted font-mono">
          ตัวอย่าง: <span className="text-brand-600 font-semibold">{s.invoiceNumberPrefix}-2026-000001</span>
        </p>
      </div>
      <FieldRow label="ระยะเวลาชำระ (วัน)" hint="J8 — นับจากวันออกใบ">
        <NumberInput value={s.invoiceDueDays} onChange={(v) => set("invoiceDueDays", v)} min={1} max={90} />
      </FieldRow>

      {/* WHT & Tax Rules */}
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 mt-6">กฎภาษี / Tax Rules</p>
      <FieldRow
        label="WHT Threshold (฿)"
        hint="J9 — หัก ณ ที่จ่ายเมื่อยอดรวม ≥ จำนวนนี้ (กฎหมาย ≥ 1,000฿)"
      >
        <NumberInput value={s.invoiceWhtThreshold} onChange={(v) => set("invoiceWhtThreshold", v)} min={0} step={100} />
      </FieldRow>
      <div className="mb-1 mt-1 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-xs text-amber-700">
          อัตรา VAT ({(s.vatRate * 100).toFixed(0)}%) และ WHT ({(s.whtRate * 100).toFixed(0)}%) ตั้งค่าในแท็บ G · Financial
        </p>
      </div>

      {/* Receipt Display Options */}
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 mt-6">ตัวเลือกแสดงผลใบเสร็จ</p>
      <FieldRow label="แสดงบรรทัด VAT" hint="J10">
        <BoolToggle
          value={s.invoiceReceiptShowVat}
          onChange={(v) => set("invoiceReceiptShowVat", v)}
          label={s.invoiceReceiptShowVat ? "แสดง" : "ซ่อน"}
        />
      </FieldRow>
      <FieldRow label="แสดงบรรทัด WHT" hint="J11">
        <BoolToggle
          value={s.invoiceReceiptShowWht}
          onChange={(v) => set("invoiceReceiptShowWht", v)}
          label={s.invoiceReceiptShowWht ? "แสดง" : "ซ่อน"}
        />
      </FieldRow>
      <FieldRow label="หมายเหตุท้ายใบเสร็จ" hint="J12 — แสดงที่ footer ของทุกใบ (ว่างเปล่าได้)">
        <TextareaInput value={s.invoiceReceiptFooterNote} onChange={(v) => set("invoiceReceiptFooterNote", v)} rows={2} />
      </FieldRow>
    </div>
  );
}

function TabLegal({ s, set }: { s: PlatformSettings; set: (k: keyof PlatformSettings, v: unknown) => void }) {
  return (
    <div>
      <FieldRow label="Privacy Policy URL" hint="Group I1">
        <TextInput value={s.privacyPolicyUrl} onChange={(v) => set("privacyPolicyUrl", v)} mono />
      </FieldRow>
      <FieldRow label="PDPA Context Link" hint="Group I2">
        <TextInput value={s.pdpaContextLink} onChange={(v) => set("pdpaContextLink", v)} mono />
      </FieldRow>
      <FieldRow label="Widget Disclaimer Message" hint="Group I3 — แสดงใน widget footer">
        <TextareaInput value={s.widgetDisclaimerMessage} onChange={(v) => set("widgetDisclaimerMessage", v)} />
      </FieldRow>
      <FieldRow label="Privacy Policy HTML" hint="Group I4 — Rich text (HTML)">
        <TextareaInput value={s.privacyPolicyHtml} onChange={(v) => set("privacyPolicyHtml", v)} rows={10} />
      </FieldRow>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function PlatformConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>("trial");
  const [settings, setSettings]   = useState<PlatformSettings | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d.settings); setLoading(false); })
      .catch(() => { setError("ไม่สามารถโหลดการตั้งค่า"); setLoading(false); });
  }, []);

  const setField = useCallback((key: keyof PlatformSettings, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("save_failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-red-500 text-sm">{error ?? "ไม่พบการตั้งค่า"}</p>;
  }

  const tabContent: Record<TabId, React.ReactNode> = {
    trial:       <TabTrial       s={settings} set={setField} />,
    quota:       <TabQuota       s={settings} set={setField} />,
    grace:       <TabGrace       s={settings} set={setField} />,
    bot:         <TabBot         s={settings} set={setField} />,
    centralized: <TabCentralized s={settings} set={setField} />,
    sandbox:     <TabSandbox     s={settings} set={setField} />,
    financial:   <TabFinancial   s={settings} set={setField} />,
    cdn:         <TabCdn         s={settings} set={setField} />,
    legal:       <TabLegal       s={settings} set={setField} />,
    tax:         <TabTax         s={settings} set={setField} />,
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Platform Config</h1>
          <p className="text-sm text-text-muted mt-0.5">Master Config Table — 10 Groups · ทุกเงื่อนไขธุรกิจแก้ไขได้ที่นี่</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span>✓</span> บันทึกแล้ว
            </span>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังบันทึก
              </span>
            ) : "บันทึกการตั้งค่า"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              activeTab === tab.id
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface-primary text-text-secondary border-border-default hover:border-brand-300 hover:text-brand-600",
            ].join(" ")}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card-premium p-6">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
