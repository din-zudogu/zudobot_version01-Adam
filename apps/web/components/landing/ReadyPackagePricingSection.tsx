"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge }   from "@/components/ui/Badge";
import { Button }  from "@/components/ui/Button";
import { useLang } from "@/lib/i18n";
import type { PublicCustomizeScenario } from "@/app/api/public/customize-scenarios/route";

// ── Types ────────────────────────────────────────────────────────────

interface SpecLine { icon: string; label: string; details: string }

interface ReadyPackage {
  _id:               string;
  name:              string;
  sortOrder:         number;
  isTrial:           boolean;
  trialDays?:        number;
  isPartnerAllowed:  boolean;
  finalRetailPrice:  number;
  finalPartnerPrice: number;
  specSummary:       SpecLine[];
  standardFeatures:  string[];
  items: Array<{
    plan:              string;
    packageName:       string;
    messageCount?:     number;
    tokensPerMessage?: number;
    storageExpireDays?: number;
  }>;
}

// formatPrice removed — PackageCard now uses convertPrice from useLang()

// ── Sub-components ───────────────────────────────────────────────────

function TrialBanner({ pkg }: { pkg: ReadyPackage }) {
  return (
    <div className="mb-12 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 md:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-amber-900">
              🎁 ทดลองใช้ฟรี {pkg.trialDays ?? 14} วัน
            </span>
          </div>
          <h3 className="text-xl font-bold text-amber-900 mb-1">{pkg.name}</h3>
          <p className="text-sm text-amber-700 mb-3">ไม่ต้องผูกบัตรเครดิต • เริ่มใช้งานได้ทันที</p>

          {/* Spec */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-800 mb-4">
            {pkg.specSummary.map((line, i) => (
              <span key={i}>
                {line.icon} <strong>{line.label}</strong>
                {line.details ? ` — ${line.details}` : ""}
              </span>
            ))}
          </div>

          {/* Features */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {pkg.standardFeatures.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="text-amber-500">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-3xl font-black text-amber-900">ฟรี</p>
          <p className="text-xs text-amber-600 mb-3">{pkg.trialDays ?? 14} วัน</p>
          <Link
            href={`/register?pkg=${pkg._id}`}
            className="inline-block px-6 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
          >
            เริ่มทดลองฟรี →
          </Link>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg, highlighted = false }: { pkg: ReadyPackage; highlighted?: boolean }) {
  const { convertPrice, t } = useLang();
  return (
    <div
      className={`relative rounded-2xl border-2 p-6 flex flex-col transition-shadow hover:shadow-lg ${
        highlighted
          ? "border-brand-500 bg-white shadow-md"
          : "border-border-default bg-white"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full text-xs font-bold bg-brand-600 text-white shadow">
            ยอดนิยม
          </span>
        </div>
      )}

      <h3 className="text-lg font-bold text-text-primary mb-1">{pkg.name}</h3>

      {/* Price */}
      <div className="mb-4">
        <span className="text-3xl font-black text-brand-600">
          {convertPrice(pkg.finalRetailPrice)}
        </span>
        {pkg.finalRetailPrice > 0 && (
          <span className="text-sm text-text-muted ml-1">{t("landing.pricing.perMonth")}</span>
        )}
      </div>

      {/* Spec summary */}
      <div className="space-y-1 mb-4">
        {pkg.specSummary.map((line, i) => (
          <p key={i} className="text-xs text-text-secondary">
            <span className="mr-1">{line.icon}</span>
            <strong>{line.label}</strong>
            {line.details ? ` — ${line.details}` : ""}
          </p>
        ))}
      </div>

      {/* Standard features */}
      <ul className="space-y-1 mb-6 flex-1">
        {pkg.standardFeatures.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="text-emerald-500 font-bold">✓</span> {f}
          </li>
        ))}
      </ul>

      <Link
        href={`/checkout?pkg=${pkg._id}`}
        className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors ${
          highlighted
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-brand-600 text-brand-600 hover:bg-brand-50"
        }`}
      >
        เริ่มใช้งาน
      </Link>
    </div>
  );
}

// ── Customize Package Preview (landing page — no DB save, CTA → checkout) ────

type ScenarioGroups = {
  ai_base: PublicCustomizeScenario[];
  storage: PublicCustomizeScenario[];
  expired: PublicCustomizeScenario[];
};

// Used only for n <= 0 (free) case in ScenarioRow — text is language-neutral "ฟรี/Free"
function fmtFreeLabel(formatFree: () => string) {
  return formatFree();
}

function specLine(o: PublicCustomizeScenario): string | null {
  if (o.isTrialPackage) return "ทดลองใช้ฟรี";
  if (o.calculationType === "ai_base") {
    if (o.messageCount && o.messageCount > 0) {
      const mo = o.aiBaseMonths && o.aiBaseMonths > 1 ? `/${o.aiBaseMonths} เดือน` : "/เดือน";
      return `${o.messageCount.toLocaleString("th-TH")} ข้อความ${mo}`;
    }
  }
  if (o.calculationType === "storage") {
    if (o.storageMbPerMonth && o.storageMbPerMonth > 0) {
      const gb = o.storageMbPerMonth >= 1024
        ? `${(o.storageMbPerMonth / 1024).toFixed(1)} GB`
        : `${o.storageMbPerMonth.toLocaleString("th-TH")} MB`;
      return `Storage ${gb}/เดือน`;
    }
  }
  if (o.calculationType === "expired") {
    if (o.storageExpireDays && o.storageExpireDays > 0) {
      return `เก็บประวัติ ${o.storageExpireDays.toLocaleString("th-TH")} วัน`;
    }
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

function ScenarioRow({
  items,
  selected,
  onSelect,
  disabled = false,
  convertPrice,
  formatFree,
}: {
  items: PublicCustomizeScenario[];
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  convertPrice: (n: number) => string;
  formatFree: () => string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity ${disabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
      {items.map((o) => {
        const active = !disabled && selected === o.id;
        const spec   = specLine(o);
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(o.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              active
                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                : "border-border-default bg-white hover:border-brand-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  active ? "border-brand-600 bg-brand-600" : "border-zinc-300"
                }`}
              >
                {active && <div className="w-1 h-1 rounded-full bg-white" />}
              </div>
              <span className={`text-xs font-semibold leading-tight ${active ? "text-brand-700" : "text-text-primary"}`}>
                {o.label}
              </span>
              {o.isBestPriceHighlight && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-bold shrink-0">
                  ★ Best
                </span>
              )}
            </div>
            {spec && (
              <p className={`text-[11px] ml-5 mb-1 ${active ? "text-brand-600" : "text-text-muted"}`}>
                {spec}
              </p>
            )}
            <p className={`text-xs font-bold ml-5 ${active ? "text-brand-600" : "text-text-secondary"}`}>
              {o.bestPriceZudobot > 0 ? `${convertPrice(o.bestPriceZudobot)}/เดือน` : fmtFreeLabel(formatFree)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CustomizePackagePreview({
  scenarios,
  loadingScenarios,
  aiBaseId,   onAiBaseChange,
  storageId,  onStorageChange,
  expiredId,  onExpiredChange,
  aiBaseEnabled,   onAiBaseEnabledChange,
  storageEnabled,  onStorageEnabledChange,
  expiredEnabled,  onExpiredEnabledChange,
  convertPrice,
  formatFree,
}: {
  scenarios:        ScenarioGroups;
  loadingScenarios: boolean;
  aiBaseId:  string; onAiBaseChange:  (id: string) => void;
  storageId: string; onStorageChange: (id: string) => void;
  expiredId: string; onExpiredChange: (id: string) => void;
  aiBaseEnabled:  boolean; onAiBaseEnabledChange:  (v: boolean) => void;
  storageEnabled: boolean; onStorageEnabledChange: (v: boolean) => void;
  expiredEnabled: boolean; onExpiredEnabledChange: (v: boolean) => void;
  convertPrice: (n: number) => string;
  formatFree: () => string;
}) {
  const aiBasePrice  = aiBaseEnabled  ? (scenarios.ai_base.find(s => s.id === aiBaseId)?.bestPriceZudobot  ?? 0) : 0;
  const storagePrice = storageEnabled ? (scenarios.storage.find(s => s.id === storageId)?.bestPriceZudobot ?? 0) : 0;
  const expiredPrice = expiredEnabled ? (scenarios.expired.find(s => s.id === expiredId)?.bestPriceZudobot ?? 0) : 0;
  const totalAddon   = aiBasePrice + storagePrice + expiredPrice;

  return (
    <div className="mt-6 rounded-2xl border border-border-default bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-50 to-violet-50 px-6 py-5 border-b border-border-default">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Your Own Customize Package
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              เลือกเสริมเฉพาะสิ่งที่คุณต้องการ — แพ็กเกจของคุณเอง ไม่มีของที่ไม่ได้ใช้
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-7">
        {loadingScenarios ? (
          <div className="space-y-6 animate-pulse">
            {[1,2,3].map(i => (
              <div key={i}>
                <div className="h-4 w-48 rounded bg-surface-secondary mb-3" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[1,2,3,4].map(j => (
                    <div key={j} className="h-14 rounded-xl bg-surface-secondary" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Category 1: AI Base */}
            {scenarios.ai_base.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🤖</span>
                  <p className="text-sm font-bold text-text-primary">AI Base</p>
                  <span className="text-xs text-text-muted">— จำนวนข้อความ AI ต่อเดือน</span>
                  <GroupToggle enabled={aiBaseEnabled} onToggle={onAiBaseEnabledChange} />
                </div>
                <ScenarioRow items={scenarios.ai_base} selected={aiBaseId} onSelect={onAiBaseChange} disabled={!aiBaseEnabled} convertPrice={convertPrice} formatFree={formatFree} />
              </div>
            )}

            {/* Category 2: Storage */}
            {scenarios.storage.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">💾</span>
                  <p className="text-sm font-bold text-text-primary">Storage Add-on</p>
                  <span className="text-xs text-text-muted">— พื้นที่จัดเก็บข้อมูล AI</span>
                  <GroupToggle enabled={storageEnabled} onToggle={onStorageEnabledChange} />
                </div>
                <ScenarioRow items={scenarios.storage} selected={storageId} onSelect={onStorageChange} disabled={!storageEnabled} convertPrice={convertPrice} formatFree={formatFree} />
              </div>
            )}

            {/* Category 3: Expired */}
            {scenarios.expired.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📅</span>
                  <p className="text-sm font-bold text-text-primary">Memory Expired Add-on</p>
                  <span className="text-xs text-text-muted">— ระยะเวลาเก็บบทสนทนา</span>
                  <GroupToggle enabled={expiredEnabled} onToggle={onExpiredEnabledChange} />
                </div>
                <ScenarioRow items={scenarios.expired} selected={expiredId} onSelect={onExpiredChange} disabled={!expiredEnabled} convertPrice={convertPrice} formatFree={formatFree} />
              </div>
            )}
          </>
        )}

        {/* Price summary + CTA */}
        <div className="rounded-xl bg-surface-secondary border border-border-default p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">ราคารวมแพ็กเกจที่เลือก (Final Price Zudobot Retail)</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-brand-600 font-mono">
                {totalAddon > 0 ? convertPrice(totalAddon) : "—"}
              </span>
              {totalAddon > 0 && <span className="text-xs text-text-muted">/เดือน (ยังไม่รวม VAT)</span>}
            </div>
            <p className="text-xs text-text-muted mt-0.5">เลือกอย่างน้อย 1 หมวดเพื่อดูราคา</p>
          </div>
          <Link
            href="/register"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            สร้างแพ็กเกจของฉัน →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function ReadyPackagePricingSection() {
  const { t, convertPrice, formatFree, lang } = useLang();
  const [trialPackages,     setTrialPackages]     = useState<ReadyPackage[]>([]);
  const [mainPackages,      setMainPackages]      = useState<ReadyPackage[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(false);
  const [scenarios,         setScenarios]         = useState<ScenarioGroups>({ ai_base: [], storage: [], expired: [] });
  const [loadingScenarios,  setLoadingScenarios]  = useState(true);

  // Customize package selection state (scenario IDs)
  const [aiBaseId,   setAiBaseId]   = useState("");
  const [storageId,  setStorageId]  = useState("");
  const [expiredId,  setExpiredId]  = useState("");

  // Toggle state — whether each group is included in the package
  const [aiBaseEnabled,  setAiBaseEnabled]  = useState(true);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [expiredEnabled, setExpiredEnabled] = useState(true);

  const fetchPackages = useCallback(async () => {
    try {
      const res  = await fetch("/api/public/ready-packages");
      const data = await res.json() as {
        ok: boolean;
        trialPackages: ReadyPackage[];
        mainPackages:  ReadyPackage[];
      };
      if (data.ok) {
        setTrialPackages(data.trialPackages);
        setMainPackages(data.mainPackages);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScenarios = useCallback(async () => {
    try {
      const res  = await fetch("/api/public/customize-scenarios");
      const data = await res.json() as ScenarioGroups & { ok: boolean };
      if (data.ok) {
        setScenarios({ ai_base: data.ai_base, storage: data.storage, expired: data.expired });
        // Auto-select first non-trial option in each category
        const firstAi  = data.ai_base.find(s => !s.isTrialPackage);
        const firstSt  = data.storage.find(s => !s.isTrialPackage);
        const firstEx  = data.expired.find(s => !s.isTrialPackage);
        if (firstAi) setAiBaseId(firstAi.id);
        if (firstSt) setStorageId(firstSt.id);
        if (firstEx) setExpiredId(firstEx.id);
      }
    } catch {
      // silently skip — UI shows empty
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    void fetchPackages();
    void fetchScenarios();
  }, [fetchPackages, fetchScenarios]);

  if (loading) {
    return (
      <section id="pricing" className="py-24 bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-4 text-center py-16 text-text-secondary">
          {t("common.loading")}
        </div>
      </section>
    );
  }

  // If no ReadyPackage data available, render nothing (fallback to legacy PricingSection)
  if (error || (trialPackages.length === 0 && mainPackages.length === 0)) {
    return null;
  }

  // Highlight the middle package if there are 3+
  const highlightIdx = mainPackages.length >= 3 ? 1 : 0;

  return (
    <section id="pricing" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-3">
            {t("landing.pricing.title")}
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            {t("landing.pricing.noCard")}
          </p>
        </div>

        {/* 1. Trial section */}
        {trialPackages.length > 0 && (
          <div className="mb-10">
            {trialPackages.map(pkg => (
              <TrialBanner key={pkg._id} pkg={pkg} />
            ))}
          </div>
        )}

        {/* 2. Main packages */}
        {mainPackages.length > 0 && (
          <>
            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 mb-2">
                🚀 แพ็กเกจหลัก
              </span>
              <h3 className="text-xl font-bold text-text-primary">เลือกแพ็กเกจที่เหมาะกับธุรกิจของคุณ</h3>
            </div>

            <div
              className={`grid gap-6 mb-16 ${
                mainPackages.length === 1 ? "max-w-sm mx-auto" :
                mainPackages.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" :
                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {mainPackages.map((pkg, i) => (
                <PackageCard key={pkg._id} pkg={pkg} highlighted={i === highlightIdx} />
              ))}
            </div>
          </>
        )}

        {/* 3. Your Own Customize Package builder */}
        <CustomizePackagePreview
          scenarios={scenarios}
          loadingScenarios={loadingScenarios}
          aiBaseId={aiBaseId}   onAiBaseChange={setAiBaseId}
          storageId={storageId} onStorageChange={setStorageId}
          expiredId={expiredId} onExpiredChange={setExpiredId}
          aiBaseEnabled={aiBaseEnabled}   onAiBaseEnabledChange={setAiBaseEnabled}
          storageEnabled={storageEnabled} onStorageEnabledChange={setStorageEnabled}
          expiredEnabled={expiredEnabled} onExpiredEnabledChange={setExpiredEnabled}
          convertPrice={convertPrice}
          formatFree={formatFree}
        />

        {/* Enterprise */}
        <div className="mt-10 card-premium border-gold-glow max-w-2xl mx-auto p-6 text-center">
          <Badge variant="gold" className="mb-3">Enterprise</Badge>
          <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
            สำหรับองค์กรขนาดใหญ่
          </h3>
          <p className="text-text-secondary text-sm mb-4">
            Pay-per-use • KYC นิติบุคคล • วางบิลรายเดือน • SLA &amp; Contract
            <br />
            คิดตาม API cost จริง (Cost-Plus Pricing)
          </p>
          <Link href="mailto:enterprise@zudogu.com">
            <Button variant="gold" size="sm">ติดต่อฝ่าย Enterprise →</Button>
          </Link>
        </div>

        {/* Guarantee */}
        <p className="text-center text-xs text-text-muted mt-8">
          {lang === "th"
            ? t("landing.pricing.guarantee")
            : t("landing.pricing.guarantee")}
        </p>
      </div>
    </section>
  );
}
