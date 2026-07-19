"use client";

import { useState, useEffect } from "react";

interface PackageOption {
  packageId: string;
  label: string;
  priceThb: number;
  partnerCost?: number;
}

export default function PartnerInvitePage() {
  const [basePlans,    setBasePlans]    = useState<PackageOption[]>([]);
  const [memoryAddons, setMemoryAddons] = useState<PackageOption[]>([]);
  const [retentionAddons, setRetentionAddons] = useState<PackageOption[]>([]);

  const [planId,      setPlanId]      = useState("");
  const [memoryId,    setMemoryId]    = useState("");
  const [retentionId, setRetentionId] = useState("");

  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<{ checkoutUrl: string; expiresAt: string } | null>(null);
  const [error,       setError]       = useState("");
  const [copied,      setCopied]      = useState(false);

  useEffect(() => {
    fetch("/api/partner/plans")
      .then((r) => r.json())
      .then((d) => {
        setBasePlans(d.basePlans ?? []);
        setMemoryAddons(d.memoryAddons ?? []);
        setRetentionAddons(d.retentionAddons ?? []);
      })
      .catch(() => {});
  }, []);

  const selectedPlan   = basePlans.find((p) => p.packageId === planId);
  const selectedMem    = memoryAddons.find((p) => p.packageId === memoryId);
  const selectedRet    = retentionAddons.find((p) => p.packageId === retentionId);
  const endUserPriceThb = (selectedPlan?.priceThb ?? 0) + (selectedMem?.priceThb ?? 0) + (selectedRet?.priceThb ?? 0);
  const partnerCostThb  = selectedPlan?.partnerCost ?? 0;
  const netEarningThb   = endUserPriceThb - partnerCostThb;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!planId || !memoryId || !retentionId) {
      setError("Please select all three options.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/partner/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId, memoryId, retentionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          stripe_not_connected: "Connect your Stripe account first.",
          plan_not_resellable:  "This plan is not available for resale.",
        };
        setError(msgs[data.error] ?? "Failed to generate link.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Invite a Client</h1>
      <p className="text-sm text-text-muted">
        Select a plan for your client and generate a checkout link. The link is valid for 7 days.
        Each new generation replaces the previous link.
      </p>

      <form onSubmit={handleGenerate} className="bg-surface-primary rounded-2xl border border-border-default p-6 space-y-5">
        {/* Base plan */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Base Plan</label>
          <div className="grid grid-cols-2 gap-2">
            {basePlans.length === 0 && (
              <p className="col-span-2 text-xs text-text-muted">No resellable plans available.</p>
            )}
            {basePlans.map((p) => (
              <button
                key={p.packageId}
                type="button"
                onClick={() => setPlanId(p.packageId)}
                className={[
                  "flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors",
                  planId === p.packageId
                    ? "border-brand-600 bg-brand-50 text-brand-700 font-semibold"
                    : "border-border-default text-text-secondary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <span>{p.label}</span>
                <span className="text-xs opacity-70">{thb(p.priceThb)}/mo</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quota */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Quota Add-on (เพิ่มข้อความ/เดือน)</label>
          <div className="grid grid-cols-2 gap-2">
            {memoryAddons.map((p) => (
              <button
                key={p.packageId}
                type="button"
                onClick={() => setMemoryId(p.packageId)}
                className={[
                  "flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors",
                  memoryId === p.packageId
                    ? "border-brand-600 bg-brand-50 text-brand-700 font-semibold"
                    : "border-border-default text-text-secondary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <span>{p.label}</span>
                <span className="text-xs opacity-70">{p.priceThb > 0 ? thb(p.priceThb)+"/mo" : "Free"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Retention */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Retention Add-on</label>
          <div className="grid grid-cols-2 gap-2">
            {retentionAddons.map((p) => (
              <button
                key={p.packageId}
                type="button"
                onClick={() => setRetentionId(p.packageId)}
                className={[
                  "flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors",
                  retentionId === p.packageId
                    ? "border-brand-600 bg-brand-50 text-brand-700 font-semibold"
                    : "border-border-default text-text-secondary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <span>{p.label}</span>
                <span className="text-xs opacity-70">{p.priceThb > 0 ? thb(p.priceThb)+"/mo" : "Free"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        {planId && memoryId && retentionId && (
          <div className="bg-surface-secondary rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Client pays (total)</span>
              <span className="font-semibold text-text-primary">{thb(endUserPriceThb)}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Zudobot platform fee</span>
              <span className="text-red-600">−{thb(partnerCostThb)}/mo</span>
            </div>
            <div className="h-px bg-border-default my-1" />
            <div className="flex justify-between font-bold">
              <span className="text-text-primary">Your earnings (est.)</span>
              <span className="text-green-600">{thb(netEarningThb)}/mo</span>
            </div>
            <p className="text-xs text-text-muted pt-1">*Before Stripe transaction fees (~3.4% + ฿10)</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !planId || !memoryId || !retentionId}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate Checkout Link"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-green-800">✅ Checkout link ready!</p>
          <p className="text-xs text-green-700">
            Expires: {new Date(result.expiresAt).toLocaleString("th-TH")}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.checkoutUrl}
              className="flex-1 px-3 py-2 rounded-xl border border-green-300 bg-white text-xs text-text-primary"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-green-700">
            Share this link with your client. When they pay, Zudobot automatically routes funds to your Stripe account.
          </p>
        </div>
      )}
    </div>
  );
}
