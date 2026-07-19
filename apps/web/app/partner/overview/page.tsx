"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PartnerProfile {
  _id: string;
  companyName: string;
  email: string;
  status: string;
  isStripeConnected: boolean;
  totalActiveSlots: number;
  totalEarningsThb: number;
}

interface Earnings {
  activeSlots: number;
  totalGrossThb: number;
  totalPlatformThb: number;
  totalNetThb: number;
  lifetimeEarningsThb: number;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function PartnerOverviewPage() {
  const [profile,  setProfile]  = useState<PartnerProfile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const [pRes, eRes] = await Promise.all([
        fetch("/api/partner/me"),
        fetch("/api/partner/earnings"),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setProfile(d.partner); }
      if (eRes.ok) { const d = await eRes.json(); setEarnings(d); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-text-muted text-sm">Loading…</div>;
  }

  if (!profile) {
    return <div className="text-sm text-red-500">Failed to load partner profile.</div>;
  }

  const thb = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{profile.companyName}</h1>
          <p className="text-xs text-text-muted">{profile.email}</p>
        </div>
        <span className={[
          "text-xs font-semibold px-3 py-1 rounded-full",
          profile.status === "active"    ? "bg-green-100 text-green-700" :
          profile.status === "invited"   ? "bg-amber-100 text-amber-700" :
          "bg-red-100 text-red-700",
        ].join(" ")}>
          {profile.status.toUpperCase()}
        </span>
      </div>

      {/* Stripe Connect warning */}
      {!profile.isStripeConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Stripe account not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">Connect your Stripe account to start accepting payments from clients.</p>
          </div>
          <Link
            href="/partner/stripe-connect"
            className="shrink-0 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors"
          >
            Connect Now
          </Link>
        </div>
      )}

      {/* Stats */}
      {earnings && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Active Clients"   value={String(earnings.activeSlots)} />
          <StatCard label="Monthly Revenue"  value={thb(earnings.totalGrossThb)} sub="gross (what clients pay)" />
          <StatCard label="Platform Fee"     value={thb(earnings.totalPlatformThb)} sub="Zudobot deducts" />
          <StatCard label="Your Earnings"    value={thb(earnings.totalNetThb)} sub="est. net this month" />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/partner/invite"
          className="bg-brand-600 text-white rounded-2xl p-5 hover:bg-brand-700 transition-colors"
        >
          <p className="text-lg font-bold mb-1">🔗 Invite a Client</p>
          <p className="text-xs opacity-80">Generate a checkout link for a new client.</p>
        </Link>
        <Link
          href="/partner/clients"
          className="bg-surface-primary border border-border-default rounded-2xl p-5 hover:bg-surface-secondary transition-colors"
        >
          <p className="text-lg font-bold text-text-primary mb-1">👥 View Clients</p>
          <p className="text-xs text-text-muted">See all your managed client accounts.</p>
        </Link>
      </div>
    </div>
  );
}
