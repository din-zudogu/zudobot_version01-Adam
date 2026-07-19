"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PLAN_CATALOG,
  QUOTA_ADDON_CATALOG,
  RETENTION_ADDON_CATALOG,
} from "@/lib/payment/pmRules";
import type { PlanId, QuotaAddonId, RetentionAddonId } from "@/lib/payment/pmRules";

type EntityType = "individual" | "corporate";

interface PkgOption {
  packageId:   string;
  label:       string;
  partnerCost: number;
  priceThb?:   number;
  msgPerMonth?: number;
}

const QUOTA_OPTIONS: { id: QuotaAddonId; label: string; note: string }[] = [
  { id: "none",      label: "ไม่เพิ่ม",              note: "ใช้โควต้าตาม Base Plan" },
  { id: "quota_1k",  label: "+1,000 ข้อความ/เดือน",  note: "เหมาะสำหรับธุรกิจเล็ก" },
  { id: "quota_5k",  label: "+5,000 ข้อความ/เดือน",  note: "คุ้มค่าที่สุด" },
  { id: "quota_20k", label: "+20,000 ข้อความ/เดือน", note: "ธุรกิจขนาดกลาง" },
];

const RETENTION_OPTIONS: { id: RetentionAddonId; label: string }[] = [
  { id: "standard", label: "7 วัน — มาตรฐาน (ฟรี)" },
  { id: "ret_30d",  label: "30 วัน" },
  { id: "ret_90d",  label: "90 วัน" },
];

// Static plan list — cards always render; partnerCost overlay from API
const BASE_PLAN_IDS: PlanId[] = ["starter", "pro", "master"];

function thb(n: number) { return `฿${n.toLocaleString("th-TH")}`; }

const INPUT_CLS  = "w-full px-3 py-2.5 rounded-xl border border-border-default text-sm focus:outline-none focus:border-brand-400 transition-colors bg-surface-secondary";
const LABEL_CLS  = "block text-xs text-text-muted mb-1";
const TEXTAREA_CLS = `${INPUT_CLS} resize-none`;

// ── Main form ────────────────────────────────────────────────────────────────

function ProvisionForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const activated = searchParams.get("activated")   === "1";
  const cancelled = searchParams.get("cancelled")   === "1";
  const sessionId = searchParams.get("session_id") ?? "";

  // Plans
  const [basePlans,    setBasePlans]    = useState<PkgOption[]>([]);
  const [memoryAddons, setMemoryAddons] = useState<PkgOption[]>([]);
  const [retAddons,    setRetAddons]    = useState<PkgOption[]>([]);

  // Entity toggle
  const [entityType,     setEntityType]     = useState<EntityType>("individual");

  // Individual fields
  const [fullName,       setFullName]       = useState("");
  const [nationalId,     setNationalId]     = useState("");
  const [addressBilling, setAddressBilling] = useState("");

  // Corporate fields
  const [corporateName,  setCorporateName]  = useState("");
  const [taxId,          setTaxId]          = useState("");
  const [addressOffice,  setAddressOffice]  = useState("");
  const [branchCode,     setBranchCode]     = useState("");
  const [contactPerson,  setContactPerson]  = useState("");

  // Shared PII
  const [phone,          setPhone]          = useState("");
  const [email,          setEmail]          = useState("");

  // Business info
  const [businessName,   setBusinessName]   = useState("");
  const [websiteUrl,     setWebsiteUrl]     = useState("");

  // Package selection
  const [planId,   setPlanId]   = useState<PlanId>("starter");
  const [quotaId,  setQuotaId]  = useState<QuotaAddonId>("none");
  const [retId,    setRetId]    = useState<RetentionAddonId>("standard");

  const [loading,    setLoading]    = useState(false);
  const [activating, setActivating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error,      setError]      = useState("");

  useEffect(() => {
    fetch("/api/partner/plans")
      .then((r) => r.json())
      .then((d) => {
        setBasePlans(d.basePlans ?? []);
        setMemoryAddons(d.memoryAddons ?? []);
        setRetAddons(d.retentionAddons ?? []);
      })
      .catch(() => {});
  }, []);

  // Activate after successful Stripe payment
  useEffect(() => {
    if (!activated || !sessionId) return;
    setActivating(true);
    fetch(`/api/partner/provision?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSuccessMsg("บัญชีลูกค้าถูกเปิดใช้งานเรียบร้อยแล้ว");
          setTimeout(() => router.replace("/partner/clients"), 3000);
        } else {
          setError(d.error ?? "activation_failed");
        }
      })
      .catch(() => setError("network_error"))
      .finally(() => setActivating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, sessionId]);

  // ── Pricing calcs ───────────────────────────────────────────────────────────
  // Retail always from static PLAN_CATALOG; partner cost from API (may be 0 until loaded)
  const selBase  = basePlans.find((p) => p.packageId === planId);
  const selQuota = memoryAddons.find((p) => p.packageId === quotaId);
  const selRet   = retAddons.find((p) => p.packageId === retId);

  const retailBase      = PLAN_CATALOG[planId].priceThb;
  const retailQuota     = quotaId !== "none"     ? (QUOTA_ADDON_CATALOG[quotaId]?.priceThb ?? 0) : 0;
  const retailRetention = retId   !== "standard" ? (RETENTION_ADDON_CATALOG[retId]?.priceThb ?? 0) : 0;
  const retailSubtotal  = retailBase + retailQuota + retailRetention;

  const partnerBase      = selBase?.partnerCost ?? 0;
  const partnerQuota     = quotaId !== "none"     ? (selQuota?.partnerCost ?? 0) : 0;
  const partnerRetention = retId   !== "standard" ? (selRet?.partnerCost   ?? 0) : 0;
  const partnerSubtotal  = partnerBase + partnerQuota + partnerRetention;
  const vatAmount        = Math.round(partnerSubtotal * 0.07);
  const partnerTotal     = partnerSubtotal + vatAmount;

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate PII length
    const rawNatId = nationalId.replace(/\D/g, "");
    const rawTaxId = taxId.replace(/\D/g, "");
    if (entityType === "individual" && nationalId && rawNatId.length !== 13) {
      setError("เลขบัตรประชาชนต้องมี 13 หลัก");
      return;
    }
    if (entityType === "corporate" && taxId && rawTaxId.length !== 13) {
      setError("เลขผู้เสียภาษีต้องมี 13 หลัก");
      return;
    }

    const clientName = entityType === "individual" ? fullName : contactPerson;
    const bName      = businessName || (entityType === "corporate" ? corporateName : fullName);

    if (!email || !clientName || !bName) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        // Entity
        entityType,
        // Individual
        ...(entityType === "individual" && {
          fullName,
          nationalId,
          addressBilling,
        }),
        // Corporate
        ...(entityType === "corporate" && {
          corporateName,
          taxId,
          addressOffice,
          branchCode,
          contactPerson,
        }),
        // Shared PII
        phone,
        email,
        // Business
        businessName: bName,
        websiteUrl,
        // Package
        planId,
        quotaAddonId: quotaId,
        retentionAddonId: retId,
      };

      const res  = await fetch("/api/partner/provision", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const MSGS: Record<string, string> = {
          email_taken:         "อีเมลนี้มีผู้ใช้แล้ว",
          plan_not_resellable: "แผนนี้ไม่รองรับ Partner",
          partner_not_active:  "สถานะ Partner ไม่ Active",
          missing_fields:      "กรุณากรอกข้อมูลให้ครบ",
        };
        setError(MSGS[data.error] ?? data.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading / success states ────────────────────────────────────────────────
  if (activating) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-muted">กำลังเปิดใช้งานบัญชี…</p>
    </div>
  );

  if (successMsg) return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-4">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-bold text-text-primary">{successMsg}</h2>
      <p className="text-sm text-text-muted">กำลังพาไปที่รายชื่อลูกค้า…</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">เพิ่มลูกค้าใหม่</h1>
        <p className="text-sm text-text-muted mt-1">
          กรอกข้อมูล Legal ของลูกค้า เลือกแพ็กเกจ และชำระเงินในราคาทุนพาร์ทเนอร์
        </p>
      </div>

      {cancelled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          การชำระเงินถูกยกเลิก บัญชีลูกค้ายังไม่ถูกเปิดใช้งาน
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── Section 1: Client Profile ── */}
          <div className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-5">

            {/* Section header + entity toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">1. ข้อมูลลูกค้า (Legal Profile)</h2>
                <p className="text-xs text-text-muted mt-0.5">ข้อมูล PII จะถูกเข้ารหัส AES-256-GCM ก่อนจัดเก็บ</p>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-border-default text-xs font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setEntityType("individual")}
                  className={[
                    "px-3 py-1.5 transition-colors",
                    entityType === "individual"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-primary",
                  ].join(" ")}
                >
                  บุคคลธรรมดา
                </button>
                <button
                  type="button"
                  onClick={() => setEntityType("corporate")}
                  className={[
                    "px-3 py-1.5 transition-colors",
                    entityType === "corporate"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-primary",
                  ].join(" ")}
                >
                  นิติบุคคล
                </button>
              </div>
            </div>

            {/* ── Individual fields ── */}
            {entityType === "individual" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>ชื่อ-นามสกุลจริง *</label>
                  <input
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    type="text" required placeholder="สมชาย ใจดี"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>เลขบัตรประชาชน (National ID) * 🔒</label>
                  <input
                    value={nationalId} onChange={(e) => setNationalId(e.target.value)}
                    type="text" required placeholder="1-2345-67890-12-3" maxLength={17}
                    className={INPUT_CLS}
                  />
                  <p className="text-xs text-text-muted mt-1">เข้ารหัสก่อนบันทึก — ไม่เก็บ plain text</p>
                </div>
                <div>
                  <label className={LABEL_CLS}>เบอร์โทรศัพท์ * 🔒</label>
                  <input
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    type="tel" required placeholder="08X-XXX-XXXX"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>อีเมล * 🔒</label>
                  <input
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    type="email" required placeholder="client@example.com"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>ที่อยู่ตามทะเบียนบ้าน / จัดส่งบิล *</label>
                  <textarea
                    value={addressBilling} onChange={(e) => setAddressBilling(e.target.value)}
                    required rows={2}
                    placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                    className={TEXTAREA_CLS}
                  />
                </div>
              </div>
            )}

            {/* ── Corporate fields ── */}
            {entityType === "corporate" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>ชื่อนิติบุคคล / บริษัท *</label>
                  <input
                    value={corporateName} onChange={(e) => setCorporateName(e.target.value)}
                    type="text" required placeholder="บริษัท XYZ จำกัด"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>เลขผู้เสียภาษี (Tax ID) * 🔒</label>
                  <input
                    value={taxId} onChange={(e) => setTaxId(e.target.value)}
                    type="text" required placeholder="0-1055-XXXXX-XX-X" maxLength={17}
                    className={INPUT_CLS}
                  />
                  <p className="text-xs text-text-muted mt-1">เข้ารหัสก่อนบันทึก — ไม่เก็บ plain text</p>
                </div>
                <div>
                  <label className={LABEL_CLS}>รหัสสาขา</label>
                  <input
                    value={branchCode} onChange={(e) => setBranchCode(e.target.value)}
                    type="text" placeholder="สำนักงานใหญ่ / 00001"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>ชื่อผู้ประสานงานหลัก *</label>
                  <input
                    value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                    type="text" required placeholder="คุณสมชาย"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>เบอร์โทรศัพท์ * 🔒</label>
                  <input
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    type="tel" required placeholder="02-XXX-XXXX"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>อีเมลนิติบุคคล * 🔒</label>
                  <input
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    type="email" required placeholder="info@company.com"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>ที่อยู่สำนักงานใหญ่ / สาขา *</label>
                  <textarea
                    value={addressOffice} onChange={(e) => setAddressOffice(e.target.value)}
                    required rows={2}
                    placeholder="เลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์"
                    className={TEXTAREA_CLS}
                  />
                </div>
              </div>
            )}

            {/* Business info (shared) */}
            <div className="pt-4 border-t border-border-default grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>ชื่อธุรกิจ / ร้านค้า</label>
                <input
                  value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                  type="text" placeholder="ร้านค้า XYZ (ถ้าต่างจากชื่อข้างต้น)"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Website URL</label>
                <input
                  value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                  type="url" placeholder="https://example.com"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Package Selection ── */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-7">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">2. เลือกแพ็กเกจ</h2>
              <p className="text-xs text-text-muted mt-0.5">
                ราคาหน้าร้าน (ลูกค้าเห็น) และราคาทุนพาร์ทเนอร์ (ที่คุณจ่าย)
              </p>
            </div>

            {/* 1. Base Plan */}
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">1. Base Plan</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BASE_PLAN_IDS.map((id) => {
                  const retail     = PLAN_CATALOG[id];
                  const partnerPkg = basePlans.find((p) => p.packageId === id);
                  const active     = planId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPlanId(id)}
                      className={[
                        "relative flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                        active
                          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
                          : "border-border-default bg-surface-secondary hover:border-brand-300",
                      ].join(" ")}
                    >
                      <span className="font-heading font-bold text-text-primary">{retail.label}</span>
                      <span className="text-xl font-extrabold text-brand-600 font-heading mt-1">
                        {thb(retail.priceThb)}
                      </span>
                      <span className="text-xs text-text-muted">/เดือน (ราคาลูกค้า)</span>
                      {partnerPkg && (
                        <span className="text-xs text-emerald-600 font-semibold mt-1.5">
                          ราคาทุน: {thb(partnerPkg.partnerCost)}
                        </span>
                      )}
                      {"msgPerMonth" in retail && (
                        <span className="text-xs text-text-muted mt-1">
                          {(retail as { msgPerMonth: number }).msgPerMonth.toLocaleString("th-TH")} ข้อความ/เดือน
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Quota Add-on */}
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">2. Quota Add-on (เพิ่มข้อความ/เดือน)</p>
              <div className="space-y-2.5">
                {QUOTA_OPTIONS.map(({ id, label, note }) => {
                  const retail     = QUOTA_ADDON_CATALOG[id];
                  const partnerPkg = memoryAddons.find((p) => p.packageId === id);
                  const active     = quotaId === id;
                  return (
                    <label
                      key={id}
                      className={[
                        "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                        active
                          ? "border-brand-500 bg-brand-50"
                          : "border-border-default bg-surface-secondary hover:border-brand-300",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="quota"
                          checked={active}
                          onChange={() => setQuotaId(id)}
                          className="accent-brand-600"
                        />
                        <div>
                          <span className="text-sm font-semibold text-text-primary">{label}</span>
                          <span className="text-xs text-text-muted ml-2">{note}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className={`text-sm font-bold ${retail.priceThb === 0 ? "text-emerald-500" : "text-text-primary"}`}>
                          {retail.priceThb === 0 ? "ฟรี" : `+${thb(retail.priceThb)}`}
                        </div>
                        {partnerPkg && partnerPkg.partnerCost > 0 && (
                          <div className="text-xs text-emerald-600 font-medium">ทุน: {thb(partnerPkg.partnerCost)}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Retention Add-on */}
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">3. Retention Add-on (ระยะเวลาเก็บข้อมูล)</p>
              <div className="space-y-2.5">
                {RETENTION_OPTIONS.map(({ id, label }) => {
                  const retail     = RETENTION_ADDON_CATALOG[id];
                  const partnerPkg = retAddons.find((p) => p.packageId === id);
                  const active     = retId === id;
                  return (
                    <label
                      key={id}
                      className={[
                        "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                        active
                          ? "border-brand-500 bg-brand-50"
                          : "border-border-default bg-surface-secondary hover:border-brand-300",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="ret"
                          checked={active}
                          onChange={() => setRetId(id)}
                          className="accent-brand-600"
                        />
                        <span className="text-sm font-medium text-text-primary">{label}</span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className={`text-sm font-bold ${retail.priceThb === 0 ? "text-emerald-500" : "text-text-primary"}`}>
                          {retail.priceThb === 0 ? "ฟรี" : `+${thb(retail.priceThb)}`}
                        </div>
                        {partnerPkg && partnerPkg.partnerCost > 0 && (
                          <div className="text-xs text-emerald-600 font-medium">ทุน: {thb(partnerPkg.partnerCost)}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Summary card ─────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">

          {/* Retail price summary */}
          <div className="bg-surface-primary border border-border-default rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-5">ราคาลูกค้า (Retail)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Base Plan</span>
                <span>{thb(retailBase)}</span>
              </div>
              {retailQuota > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Quota Add-on</span>
                  <span>+{thb(retailQuota)}</span>
                </div>
              )}
              {retailRetention > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Retention</span>
                  <span>+{thb(retailRetention)}</span>
                </div>
              )}
              <div className="border-t border-border-default pt-2 flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{thb(retailSubtotal)}</span>
              </div>
            </div>
          </div>

          {/* Partner cost summary + submit */}
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-5">ยอดที่คุณจ่าย (ราคาทุน + VAT)</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Base Plan</span>
                <span>{thb(partnerBase)}</span>
              </div>
              {partnerQuota > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Quota</span>
                  <span>+{thb(partnerQuota)}</span>
                </div>
              )}
              {partnerRetention > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Retention</span>
                  <span>+{thb(partnerRetention)}</span>
                </div>
              )}
              <div className="border-t border-brand-200 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Subtotal</span><span>{thb(partnerSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>VAT 7%</span><span>+{thb(vatAmount)}</span>
                </div>
              </div>
              <div className="border-t border-brand-200 pt-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-text-primary">รวมที่จ่าย</span>
                  <span className="text-2xl font-extrabold text-brand-600 font-heading">{thb(partnerTotal)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || basePlans.length === 0}
              className="mt-5 w-full py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังดำเนินการ…
                </span>
              ) : "ชำระเงินและเปิดใช้งาน →"}
            </button>
            <p className="text-center text-xs text-text-muted mt-3">🔒 ชำระผ่าน Stripe • ข้อมูล PII เข้ารหัส AES-256</p>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function PartnerProvisionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProvisionForm />
    </Suspense>
  );
}
