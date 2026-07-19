"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import type { PublicCustomizeScenario } from "@/app/api/public/customize-scenarios/route";
import { ReadyPackageCheckoutSection } from "@/components/checkout/ReadyPackageCheckoutSection";
import { CustomizePackageSection } from "@/components/checkout/CustomizePackageSection";
import { CheckoutSummary, type SelectedAddon } from "@/components/checkout/CheckoutSummary";

// ── Shared types ──────────────────────────────────────────────────────────────

interface ReadyPkg {
  _id:              string;
  name:             string;
  isTrial:          boolean;
  trialDays?:       number;
  finalRetailPrice: number;
  specSummary:      { icon: string; label: string; details: string }[];
  standardFeatures: string[];
}

type ScenarioGroups = {
  ai_base: PublicCustomizeScenario[];
  storage:  PublicCustomizeScenario[];
  expired:  PublicCustomizeScenario[];
};

function thb(n: number) { return n > 0 ? `฿${n.toLocaleString("th-TH")}` : "ฟรี"; }

// ── Main checkout inner ───────────────────────────────────────────────────────

// ── ReadyPackage checkout flow ────────────────────────────────────────────────

interface ValidateResult {
  package: {
    _id:               string;
    name:              string;
    isTrial:           boolean;
    trialDays?:        number;
    finalRetailPrice:  number;
    finalPartnerPrice: number;
    items: Array<{
      plan:               string;
      packageName:        string;
      messageCount?:      number;
      tokensPerMessage?:  number;
      storageExpireDays?: number;
      trialDurationDays?: number;
    }>;
  };
  addonPlans: Array<{
    _id:              string;
    label:            string;
    plan:             string;
    packageName:      string;
    baseAddon:        string;
    category:         string;
    aiBaseMonths:     number;
    messageCount:     number;
    storageExpireDays?: number;
    bestPriceZudobot: number;
    isBestPriceHighlight: boolean;
    packageDescription: string;
  }>;
}

function ReadyPackageCheckout({ pkgId }: { pkgId: string }) {
  const { data: session, status } = useSession();
  const [data,           setData]           = useState<ValidateResult | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [method,         setMethod]         = useState<"card" | "promptpay">("card");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/validate?pkg=${pkgId}`);
      if (res.status === 410) { setLoadError("แพ็กเกจนี้ปิดรับสมัครแล้ว"); return; }
      if (!res.ok)            { setLoadError("ไม่พบแพ็กเกจที่ระบุ");       return; }
      const json = await res.json() as ValidateResult & { ok: boolean };
      setData(json);
    } catch {
      setLoadError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }, [pkgId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleCheckout() {
    if (!data) return;
    if (status !== "authenticated") {
      signIn(undefined, { callbackUrl: `/checkout?pkg=${pkgId}` });
      return;
    }
    if (data.package.isTrial) {
      setLoading(true);
      window.location.href = "/dashboard";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readyPackageId:   pkgId,
          addonScenarioIds: selectedAddons.map((a) => a._id),
          paymentMethod:    method,
        }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (json.url) { window.location.href = json.url; }
      else { alert(json.error ?? "เกิดข้อผิดพลาด"); }
    } catch { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
        <div className="text-center space-y-4">
          <p className="text-xl font-bold text-text-primary">⚠️ {loadError}</p>
          <Link href="/#pricing" className="text-brand-600 hover:underline text-sm">← ดูแพ็กเกจทั้งหมด</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <p className="text-text-muted animate-pulse">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  const pkg = data.package;

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <header className="bg-white border-b border-border-default sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><ZudobotLogo size="sm" variant="color" /></Link>
          {session?.user?.name && (
            <p className="text-sm text-text-muted">สวัสดี, {session.user.name}</p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">เลือกแพ็กเกจ</h1>
          <p className="text-sm text-text-muted mt-1">
            ราคายังไม่รวม VAT 7% · ยกเลิกได้ทุกเมื่อ · ไม่มีค่าธรรมเนียมแอบแฝง
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Section 1: ReadyPackage หลัก */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                1. แพ็กเกจสำเร็จรูป (หลัก)
              </p>
              <ReadyPackageCheckoutSection
                name={pkg.name}
                isTrial={pkg.isTrial}
                trialDays={pkg.trialDays}
                finalRetailPrice={pkg.finalRetailPrice}
                items={pkg.items}
              />
            </div>

            {/* Section 2: Customize Package */}
            {!pkg.isTrial && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                  2. Your Own Customize Package (เลือกได้)
                </p>
                <CustomizePackageSection
                  addonOptions={data.addonPlans}
                  onChange={(selected) => {
                    // Mirror DB-sourced retail prices into the summary; backend
                    // re-prices from these scenario _ids — never trust client amounts.
                    setSelectedAddons(selected.map((o) => ({
                      _id:              o._id,
                      label:            o.label,
                      plan:             o.category,
                      packageName:      o.label,
                      bestPriceZudobot: o.bestPriceZudobot,
                    })));
                  }}
                />
              </div>
            )}

            {/* Section 3: Payment method (hidden for trial) */}
            {!pkg.isTrial && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                  3. วิธีชำระเงิน
                </p>
                <div className="rounded-xl border border-border-default bg-white p-5 grid grid-cols-2 gap-3">
                  {(["card", "promptpay"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                        method === m ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-border-default"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${method === m ? "border-brand-600 bg-brand-600" : "border-zinc-300"}`}>
                        {method === m && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{m === "card" ? "💳 บัตรเครดิต/เดบิต" : "📱 PromptPay"}</p>
                        <p className="text-xs text-text-muted">{m === "card" ? "Visa, Mastercard · ต่ออายุอัตโนมัติ" : "QR Code · จ่ายทีละ 1 เดือน"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div>
            <CheckoutSummary
              packageName={pkg.name}
              packagePrice={pkg.finalRetailPrice}
              isTrial={pkg.isTrial}
              selectedAddons={selectedAddons}
              onCheckout={handleCheckout}
              loading={loading}
            />
            <div className="mt-3 text-center">
              <Link href="/#pricing" className="text-xs text-text-muted hover:text-brand-600">
                ← ดูแพ็กเกจทั้งหมด
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Package selector (no ?pkg= param) ────────────────────────────────────────

function PackageSelectorInner() {
  const { data: session, status } = useSession();
  const [pkgs,             setPkgs]             = useState<ReadyPkg[]>([]);
  const [scenarios,        setScenarios]        = useState<ScenarioGroups>({ ai_base: [], storage: [], expired: [] });
  const [loadingPkgs,      setLoadingPkgs]      = useState(true);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [aiBaseId,  setAiBaseId]  = useState("");
  const [storageId, setStorageId] = useState("");
  const [expiredId, setExpiredId] = useState("");
  const [aiBaseEnabled,  setAiBaseEnabled]  = useState(true);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [expiredEnabled, setExpiredEnabled] = useState(true);
  const [method,    setMethod]    = useState<"card" | "promptpay">("card");
  const [paying,    setPaying]    = useState(false);
  const [payErr,    setPayErr]    = useState<string | null>(null);

  const fetchPkgs = useCallback(async () => {
    try {
      const res  = await fetch("/api/public/ready-packages");
      const data = await res.json() as { ok: boolean; trialPackages: ReadyPkg[]; mainPackages: ReadyPkg[] };
      if (data.ok) setPkgs([...data.trialPackages, ...data.mainPackages]);
    } catch { /* silent */ } finally { setLoadingPkgs(false); }
  }, []);

  const fetchScenarios = useCallback(async () => {
    try {
      const res  = await fetch("/api/public/customize-scenarios");
      const data = await res.json() as ScenarioGroups & { ok: boolean };
      if (data.ok) {
        setScenarios({ ai_base: data.ai_base, storage: data.storage, expired: data.expired });
        const ai = data.ai_base.find(s => !s.isTrialPackage);
        const st = data.storage.find(s => !s.isTrialPackage);
        const ex = data.expired.find(s => !s.isTrialPackage);
        if (ai) setAiBaseId(ai.id);
        if (st) setStorageId(st.id);
        if (ex) setExpiredId(ex.id);
      }
    } catch { /* silent */ } finally { setLoadingScenarios(false); }
  }, []);

  useEffect(() => { void fetchPkgs(); void fetchScenarios(); }, [fetchPkgs, fetchScenarios]);

  // Effective IDs — only count groups that are toggled ON
  const effectiveAiBaseId  = aiBaseEnabled  ? aiBaseId  : "";
  const effectiveStorageId = storageEnabled ? storageId : "";
  const effectiveExpiredId = expiredEnabled ? expiredId : "";

  // Price from selected scenarios (enabled groups only)
  const aiPrice  = aiBaseEnabled  ? (scenarios.ai_base.find(s => s.id === aiBaseId)?.bestPriceZudobot  ?? 0) : 0;
  const stPrice  = storageEnabled ? (scenarios.storage.find(s => s.id === storageId)?.bestPriceZudobot ?? 0) : 0;
  const exPrice  = expiredEnabled ? (scenarios.expired.find(s => s.id === expiredId)?.bestPriceZudobot ?? 0) : 0;
  const customTotal = aiPrice + stPrice + exPrice;

  function scenarioSpec(o: PublicCustomizeScenario): string | null {
    if (o.isTrialPackage) return "ทดลองใช้ฟรี";
    if (o.calculationType === "ai_base" && o.messageCount && o.messageCount > 0) {
      const mo = o.aiBaseMonths && o.aiBaseMonths > 1 ? `/${o.aiBaseMonths} เดือน` : "/เดือน";
      return `${o.messageCount.toLocaleString("th-TH")} ข้อความ${mo}`;
    }
    if (o.calculationType === "storage" && o.storageMbPerMonth && o.storageMbPerMonth > 0) {
      const gb = o.storageMbPerMonth >= 1024
        ? `${(o.storageMbPerMonth / 1024).toFixed(1)} GB`
        : `${o.storageMbPerMonth.toLocaleString("th-TH")} MB`;
      return `Storage ${gb}/เดือน`;
    }
    if (o.calculationType === "expired" && o.storageExpireDays && o.storageExpireDays > 0) {
      return `เก็บประวัติ ${o.storageExpireDays.toLocaleString("th-TH")} วัน`;
    }
    return o.packageDescription ?? null;
  }

  function GroupToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
          enabled
            ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
        }`}
      >
        <div className={`w-7 h-4 rounded-full relative transition-colors ${enabled ? "bg-brand-500" : "bg-zinc-300"}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${enabled ? "left-3.5" : "left-0.5"}`} />
        </div>
        {enabled ? "เลือก" : "ไม่เลือก"}
      </button>
    );
  }

  function ScenarioRadio({
    items, selected, onSelect, disabled = false,
  }: { items: PublicCustomizeScenario[]; selected: string; onSelect: (id: string) => void; disabled?: boolean }) {
    const visibleItems = items.filter(o => !o.isTrialPackage);
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-opacity ${disabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
        {visibleItems.map(o => {
          const active = !disabled && selected === o.id;
          const spec   = scenarioSpec(o);
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(active ? "" : o.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                active ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-border-default bg-white hover:border-brand-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-brand-600 bg-brand-600" : "border-zinc-300"}`}>
                  {active && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>
                <span className={`font-medium text-xs leading-tight ${active ? "text-brand-700" : "text-text-primary"}`}>{o.label}</span>
              </div>
              {spec && (
                <p className={`text-[11px] ml-5 mb-0.5 ${active ? "text-brand-500" : "text-text-muted"}`}>{spec}</p>
              )}
              <p className={`text-xs font-bold ml-5 ${active ? "text-brand-600" : "text-text-muted"}`}>
                {o.bestPriceZudobot > 0 ? `฿${o.bestPriceZudobot.toLocaleString("th-TH")}/เดือน` : "ฟรี"}
              </p>
            </button>
          );
        })}
      </div>
    );
  }

  async function handleCustomizeCheckout() {
    if (!effectiveAiBaseId && !effectiveStorageId && !effectiveExpiredId) { setPayErr("กรุณาเลือกอย่างน้อย 1 รายการ"); return; }
    if (status !== "authenticated") {
      signIn(undefined, { callbackUrl: "/checkout" });
      return;
    }
    setPaying(true); setPayErr(null);
    try {
      // Send scenario IDs only — server fetches prices from DB (never trust client price)
      // Only include IDs from groups the user has toggled ON
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioIds:  { aiBaseId: effectiveAiBaseId, storageId: effectiveStorageId, expiredId: effectiveExpiredId },
          paymentMethod: method,
        }),
      });
      const json = await res.json() as { url?: string; error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "checkout_failed");
      window.location.href = json.url!;
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally { setPaying(false); }
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="bg-white border-b border-border-default sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><ZudobotLogo size="sm" variant="color" /></Link>
          {status === "authenticated"
            ? <p className="text-sm text-text-muted">สวัสดี, {session?.user?.name}</p>
            : <Link href="/login" className="text-sm text-brand-600 hover:underline font-medium">เข้าสู่ระบบ</Link>
          }
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">เลือกแพ็กเกจที่เหมาะกับธุรกิจของคุณ</h1>
        <p className="text-sm text-text-muted mb-8">ราคายังไม่รวม VAT 7% · ยกเลิกได้ทุกเมื่อ · ไม่มีค่าธรรมเนียมแอบแฝง</p>

        {/* 1. ReadyPackages */}
        <section className="mb-8">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">1. แพ็กเกจสำเร็จรูป</p>
          {loadingPkgs ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl bg-white animate-pulse border border-border-default" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pkgs.filter(p => !p.isTrial).map(pkg => (
                <Link
                  key={pkg._id}
                  href={`/checkout?pkg=${pkg._id}`}
                  className="rounded-2xl border border-border-default bg-white p-5 hover:border-brand-400 hover:shadow-md transition-all block group"
                >
                  <p className="font-bold text-text-primary text-sm mb-1 group-hover:text-brand-700">{pkg.name}</p>
                  <p className="text-2xl font-extrabold text-brand-600 font-mono">
                    {thb(pkg.finalRetailPrice)}
                    <span className="text-xs font-normal text-text-muted ml-1">/เดือน</span>
                  </p>
                  <ul className="mt-3 space-y-1">
                    {pkg.specSummary?.slice(0, 3).map((s, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <span>{s.icon}</span><span>{s.label}</span>
                        {s.details && <span className="text-text-muted">— {s.details}</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs font-semibold text-brand-600 group-hover:underline">
                    เลือกแพ็กเกจนี้ →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 2. Your Own Customize Package */}
        <section className="mb-8">
          <div className="rounded-2xl border border-border-default bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-brand-50 to-violet-50 px-6 py-4 border-b border-border-default">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <p className="font-bold text-text-primary text-sm">2. Your Own Customize Package</p>
                  <p className="text-xs text-text-muted">เลือกเฉพาะสิ่งที่ต้องการ — ราคาจาก Final Price Zudobot Retail</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {loadingScenarios ? (
                <div className="animate-pulse space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-secondary" />)}
                </div>
              ) : (
                <>
                  {scenarios.ai_base.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wide">🤖 AI Base</p>
                        <span className="text-xs text-text-muted">— จำนวนข้อความ AI ต่อเดือน</span>
                        <GroupToggle enabled={aiBaseEnabled} onToggle={setAiBaseEnabled} />
                      </div>
                      <ScenarioRadio items={scenarios.ai_base} selected={aiBaseId} onSelect={setAiBaseId} disabled={!aiBaseEnabled} />
                    </div>
                  )}
                  {scenarios.storage.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wide">💾 Storage Add-on</p>
                        <span className="text-xs text-text-muted">— พื้นที่จัดเก็บข้อมูล AI</span>
                        <GroupToggle enabled={storageEnabled} onToggle={setStorageEnabled} />
                      </div>
                      <ScenarioRadio items={scenarios.storage} selected={storageId} onSelect={setStorageId} disabled={!storageEnabled} />
                    </div>
                  )}
                  {scenarios.expired.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wide">📅 Memory Expired Add-on</p>
                        <span className="text-xs text-text-muted">— ระยะเวลาเก็บบทสนทนา</span>
                        <GroupToggle enabled={expiredEnabled} onToggle={setExpiredEnabled} />
                      </div>
                      <ScenarioRadio items={scenarios.expired} selected={expiredId} onSelect={setExpiredId} disabled={!expiredEnabled} />
                    </div>
                  )}
                </>
              )}

              {/* Payment method */}
              <div className="border-t border-border-default pt-5">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">3. วิธีชำระเงิน</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "card",      label: "💳 บัตรเครดิต/เดบิต", desc: "Visa, Mastercard · ต่ออายุอัตโนมัติ" },
                    { id: "promptpay", label: "📱 PromptPay",         desc: "QR Code · จ่ายทีละ 1 เดือน" },
                  ] as const).map(({ id, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMethod(id)}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        method === id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-border-default hover:border-brand-300"
                      }`}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center ${method === id ? "border-brand-600 bg-brand-600" : "border-zinc-300"}`}>
                        {method === id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price summary + CTA */}
              <div className="rounded-xl bg-surface-secondary border border-border-default p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-text-muted">ราคารวมที่เลือก (Final Price Zudobot Retail)</p>
                  <p className="text-2xl font-extrabold text-brand-600 font-mono">
                    {customTotal > 0 ? `฿${customTotal.toLocaleString("th-TH")}` : "—"}
                    {customTotal > 0 && <span className="text-xs font-normal text-text-muted ml-1">/เดือน (ยังไม่รวม VAT)</span>}
                  </p>
                  {payErr && <p className="text-xs text-red-500 mt-1">{payErr}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleCustomizeCheckout}
                  disabled={paying || customTotal <= 0}
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paying ? "กำลังเชื่อมต่อ Stripe..." : status !== "authenticated" ? "เข้าสู่ระบบเพื่อชำระเงิน →" : "ชำระเงินด้วย Stripe →"}
                </button>
              </div>

              <p className="text-xs text-text-muted text-center">🔒 ชำระผ่าน Stripe · ปลอดภัย 100% · ใบกำกับภาษีออกโดย Zudogu Co., Ltd.</p>
            </div>
          </div>
        </section>

        <div className="text-center">
          <Link href="/#pricing" className="text-xs text-text-muted hover:text-brand-600">← ดูแพ็กเกจทั้งหมดในหน้าหลัก</Link>
        </div>
      </main>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

function CheckoutInner() {
  const searchParams = useSearchParams();
  const pkgId = searchParams.get("pkg");
  if (pkgId) return <ReadyPackageCheckout pkgId={pkgId} />;
  return <PackageSelectorInner />;
}

// ── Page export with Suspense (useSearchParams requires it) ───────────────────

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutInner />
    </Suspense>
  );
}
