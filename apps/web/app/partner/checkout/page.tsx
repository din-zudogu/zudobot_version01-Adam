"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

function CheckoutForm() {
  const searchParams = useSearchParams();
  const token       = searchParams.get("token") ?? "";
  const planId      = searchParams.get("planId") ?? "";
  const memoryId    = searchParams.get("memoryId") ?? "";
  const retentionId = searchParams.get("retentionId") ?? "";

  const [email,   setEmail]   = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token || !planId || !memoryId || !retentionId) {
      setError("Invalid checkout link. Please ask your partner for a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/partner-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: token,
          planId,
          memoryId,
          retentionId,
          tenantId: email.toLowerCase().replace(/[^a-z0-9]/g, ""),
          email,
          name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          invalid_token:        "This checkout link is invalid or has expired.",
          partner_not_connected:"The partner&apos;s payment system is not set up yet.",
          invalid_plan:         "The selected plan is no longer available.",
          plan_not_resellable:  "This plan cannot be purchased through this link.",
        };
        setError(msgs[data.error] ?? "Checkout failed. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !planId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-lg font-bold text-text-primary mb-2">Invalid Link</h2>
          <p className="text-sm text-text-muted">This checkout link is missing required information. Please ask your partner for a new link.</p>
        </div>
      </div>
    );
  }

  const planLabel = planId.charAt(0).toUpperCase() + planId.slice(1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <ZudobotLogo size="md" variant="color" />
        </div>

        <h1 className="text-xl font-bold text-text-primary mb-1 text-center">Subscribe to Zudobot</h1>
        <p className="text-xs text-text-muted text-center mb-2">via Partner checkout</p>

        <div className="bg-surface-secondary rounded-xl p-4 mb-6 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-text-muted">Plan</span>
            <span className="font-semibold text-text-primary capitalize">{planLabel}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-text-muted">Quota Add-on</span>
            <span className="font-semibold text-text-primary capitalize">{memoryId.replace("mem_", "").replace("quota_", "+")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Retention</span>
            <span className="font-semibold text-text-primary capitalize">{retentionId.replace("ret_", "")}</span>
          </div>
        </div>

        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full name or business name"
              className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-secondary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-secondary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Redirecting to payment…" : "Continue to Payment"}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-4">
          Powered by Stripe. Your payment details are secure.
        </p>
      </div>
    </div>
  );
}

export default function PartnerCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text-muted text-sm">Loading…</div>}>
      <CheckoutForm />
    </Suspense>
  );
}
