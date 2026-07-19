"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface PartnerProfile {
  companyName: string;
  isStripeConnected: boolean;
  stripeConnectAccountId?: string;
}

function StripeConnectInner() {
  const searchParams = useSearchParams();
  const success    = searchParams.get("success") === "1";
  const errorParam = searchParams.get("error");

  const [profile,    setProfile]    = useState<PartnerProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/partner/me")
      .then((r) => r.json())
      .then((d) => setProfile(d.partner))
      .finally(() => setLoading(false));
  }, []);

  function handleConnect() {
    setConnecting(true);
    window.location.href = "/api/stripe/connect/authorize";
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-text-muted text-sm">Loading…</div>;
  }

  const ERROR_MESSAGES: Record<string, string> = {
    access_denied:     "You cancelled the Stripe connection. Please try again.",
    oauth_failed:      "Stripe connection failed. Please try again.",
    already_connected: "Your Stripe account is already connected.",
    missing_params:    "Invalid callback. Please start the connection process again.",
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Stripe Connect</h1>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Stripe account connected!</p>
            <p className="text-xs text-green-700 mt-0.5">You can now accept payments from your clients.</p>
          </div>
        </div>
      )}

      {errorParam && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">❌</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Connection failed</p>
            <p className="text-xs text-red-700 mt-0.5">{ERROR_MESSAGES[errorParam] ?? "An error occurred."}</p>
          </div>
        </div>
      )}

      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className={[
            "w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0",
            profile?.isStripeConnected ? "bg-green-100" : "bg-gray-100",
          ].join(" ")}>
            {profile?.isStripeConnected ? "✅" : "💳"}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {profile?.isStripeConnected ? "Connected" : "Not Connected"}
            </p>
            {profile?.isStripeConnected && profile.stripeConnectAccountId && (
              <p className="text-xs text-text-muted font-mono">{profile.stripeConnectAccountId}</p>
            )}
          </div>
          {profile?.isStripeConnected && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="h-px bg-border-default" />

        <div className="space-y-3 text-sm text-text-muted">
          <p>
            Zudobot uses <strong className="text-text-primary">Stripe Connect</strong> to automatically split
            payments between your account and Zudobot&apos;s platform.
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex gap-2"><span>→</span> Client pays the full subscription price to your Stripe account.</li>
            <li className="flex gap-2"><span>→</span> Zudobot automatically deducts the platform fee via Stripe&apos;s application fee.</li>
            <li className="flex gap-2"><span>→</span> You keep the remainder, minus Stripe&apos;s transaction fee (~3.4% + ฿10).</li>
          </ul>
          <p className="text-xs">
            You need a <strong className="text-text-primary">Thailand Stripe account</strong> to receive THB payouts.
          </p>
        </div>

        {!profile?.isStripeConnected && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>Redirecting to Stripe…</>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.208c0 4.052 2.498 5.592 6.537 7.072 2.174.807 3.032 1.443 3.032 2.568 0 1.031-.846 1.647-2.316 1.647-2.28 0-4.928-.973-6.796-2.296l-.943 5.595C4.79 23.082 7.88 24 11.39 24c2.711 0 4.892-.672 6.479-1.964 1.679-1.369 2.542-3.316 2.542-5.679 0-4.188-2.533-5.73-6.435-7.207z"/>
                </svg>
                Connect with Stripe
              </>
            )}
          </button>
        )}

        {profile?.isStripeConnected && (
          <div className="bg-surface-secondary rounded-xl p-3 text-xs text-text-muted text-center">
            To disconnect or manage your Stripe account, visit your{" "}
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline"
            >
              Stripe Dashboard
            </a>.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerStripeConnectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-text-muted text-sm">Loading…</div>}>
      <StripeConnectInner />
    </Suspense>
  );
}
