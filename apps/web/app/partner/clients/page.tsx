"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  tenantId: string;
  email: string;
  name: string;
  businessName: string;
  botState: string;
  planId: string;
  subStatus: string;
  totalThb: number;
  createdAt: string;
  partnerProvisioned?: boolean;
}

const BOT_STATE_COLOR: Record<string, string> = {
  active:             "bg-green-100 text-green-700",
  trial:              "bg-blue-100 text-blue-700",
  suspended_payment:  "bg-red-100 text-red-700",
  suspended_quota:    "bg-red-100 text-red-700",
  trial_expired:      "bg-gray-100 text-gray-700",
};

export default function PartnerClientsPage() {
  const { update }          = useSession();
  const router              = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/partner/clients?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => { setClients(d.clients ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;
  const totalPages = Math.ceil(total / limit);

  async function handleImpersonate(client: Client) {
    setImpersonating(client.tenantId);
    try {
      const res = await fetch("/api/partner/impersonate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId: client.tenantId }),
      });
      const data = await res.json();
      if (!data.ok) { setImpersonating(null); return; }
      await update({ action: "impersonate", tenantId: data.tenantId, clientName: data.clientName, partnerId: data.partnerId });
      router.push("/dashboard/overview");
    } catch {
      setImpersonating(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Clients</h1>
        <span className="text-xs text-text-muted">{total} total</span>
      </div>

      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">
            No clients yet. <a href="/partner/invite" className="ml-1 text-brand-600 underline">Invite one →</a>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Business / Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {clients.map((c) => (
                <tr key={c.tenantId} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{c.businessName || c.name}</p>
                    <p className="text-xs text-text-muted">{c.email}</p>
                    {c.partnerProvisioned && (
                      <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">Provisioned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{c.planId}</td>
                  <td className="px-4 py-3">
                    <span className={[
                      "text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize",
                      BOT_STATE_COLOR[c.botState] ?? "bg-gray-100 text-gray-700",
                    ].join(" ")}>
                      {c.botState.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">{thb(c.totalThb)}</td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">
                    {new Date(c.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/partner/buy-for-client/${c.tenantId}`}
                        className="px-2.5 py-1 rounded-lg border border-brand-600 text-brand-600 text-xs font-semibold hover:bg-brand-50 transition-colors whitespace-nowrap">
                        ซื้อแพ็กเกจ
                      </Link>
                      <button
                        onClick={() => handleImpersonate(c)}
                        disabled={impersonating === c.tenantId}
                        className="px-2.5 py-1 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {impersonating === c.tenantId ? "…" : "View Dashboard →"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
