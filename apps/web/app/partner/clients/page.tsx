"use client";

import { useEffect, useRef, useState } from "react";
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

const PLAN_OPTIONS = [
  { id: "starter", label: "Starter", priceThb: 990 },
  { id: "pro",      label: "Pro",     priceThb: 1990 },
  { id: "master",   label: "Master",  priceThb: 14990 },
];
const MEMORY_OPTIONS = [
  { id: "free",   label: "Free (1 MB)" },
  { id: "small",  label: "50 MB" },
  { id: "medium", label: "250 MB" },
  { id: "large",  label: "1 GB+" },
];
const RETENTION_OPTIONS = [
  { id: "standard", label: "7 วัน" },
  { id: "1month",   label: "1 เดือน" },
  { id: "3months",  label: "3 เดือน" },
  { id: "6months",  label: "6 เดือน" },
];

interface CreateResult {
  sessionId:     string;
  checkoutUrl:   string;
  totalThb:      number;
  customerEmail: string;
}
interface StatusResult { subscriptionStatus: string | null }

function Spinner() {
  return <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block" />;
}

function SubscribeForCustomerModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [planId, setPlanId]           = useState("starter");
  const [memoryId, setMemoryId]       = useState("free");
  const [retentionId, setRetentionId] = useState("standard");
  const [creating, setCreating]       = useState(false);
  const [order, setOrder]             = useState<CreateResult | null>(null);
  const [status, setStatus]           = useState<StatusResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscribe-for-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: client.email, planId, memoryId, retentionId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "server_error"); return; }
      setOrder(data as CreateResult);
    } catch {
      setError("server_error");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!order || status?.subscriptionStatus === "active") return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/subscribe-for-customer/status?session_id=${order.sessionId}`);
        setStatus(await res.json());
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  useEffect(() => {
    if (status?.subscriptionStatus === "active" && pollRef.current) clearInterval(pollRef.current);
  }, [status]);

  const isActive = status?.subscriptionStatus === "active";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-primary rounded-2xl border border-border-default p-5 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-text-primary">สมัคร PromptPay แทนลูกค้า</p>
          <button onClick={onClose} className="text-text-muted text-sm">✕</button>
        </div>
        <p className="text-xs text-text-muted">{client.businessName || client.name} · {client.email}</p>

        {!order && (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                className="bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {PLAN_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <select value={memoryId} onChange={(e) => setMemoryId(e.target.value)}
                className="bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {MEMORY_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <select value={retentionId} onChange={(e) => setRetentionId(e.target.value)}
                className="bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {RETENTION_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white disabled:opacity-50"
            >
              {creating ? <Spinner /> : "สร้างลิงก์ชำระเงินและส่งอีเมล"}
            </button>
            {error && <p className="text-sm text-red-600">เกิดข้อผิดพลาด: {error}</p>}
          </>
        )}

        {order && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-brand-600">฿{order.totalThb.toLocaleString()}</p>
              {isActive ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">ชำระเงินสำเร็จ</span>
              ) : (
                <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  <Spinner /> รอชำระเงิน
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input readOnly value={order.checkoutUrl} onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-xs text-text-muted" />
              <button
                onClick={() => navigator.clipboard.writeText(order.checkoutUrl)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-surface-secondary border border-border-default"
              >
                คัดลอก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerClientsPage() {
  const { update }          = useSession();
  const router              = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [subscribeFor, setSubscribeFor]   = useState<Client | null>(null);

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
                        onClick={() => setSubscribeFor(c)}
                        className="px-2.5 py-1 rounded-lg border border-emerald-600 text-emerald-600 text-xs font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
                      >
                        PromptPay ให้ลูกค้าจ่าย
                      </button>
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

      {subscribeFor && (
        <SubscribeForCustomerModal client={subscribeFor} onClose={() => setSubscribeFor(null)} />
      )}
    </div>
  );
}
