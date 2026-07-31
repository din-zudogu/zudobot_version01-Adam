"use client";

import { useEffect, useRef, useState } from "react";

interface LookupResult {
  found:         boolean;
  tenantId?:     string;
  name?:         string;
  email?:        string;
  currentPlanId?: string;
  currentStatus?: string;
}

interface PlanOption { id: string; label: string; priceThb: number }
interface MemoryOption { id: string; label: string; priceThb: number }
interface RetentionOption { id: string; label: string; priceThb: number }

const PLAN_OPTIONS: PlanOption[] = [
  { id: "starter", label: "Starter", priceThb: 990 },
  { id: "pro",      label: "Pro",     priceThb: 1990 },
  { id: "master",   label: "Master",  priceThb: 14990 },
];
const MEMORY_OPTIONS: MemoryOption[] = [
  { id: "free",   label: "Free (1 MB)", priceThb: 0 },
  { id: "small",  label: "50 MB",       priceThb: 149 },
  { id: "medium", label: "250 MB",      priceThb: 399 },
  { id: "large",  label: "1 GB+",       priceThb: 999 },
];
const RETENTION_OPTIONS: RetentionOption[] = [
  { id: "standard", label: "7 วัน",   priceThb: 0 },
  { id: "1month",   label: "1 เดือน", priceThb: 99 },
  { id: "3months",  label: "3 เดือน", priceThb: 199 },
  { id: "6months",  label: "6 เดือน", priceThb: 299 },
];

interface CreateResult {
  sessionId:     string;
  checkoutUrl:   string;
  totalThb:      number;
  customerEmail: string;
}

interface StatusResult {
  paymentStatus:      string;
  subscriptionStatus: string | null;
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />;
}

export default function SubscribeForCustomerPage() {
  const [email, setEmail]           = useState("");
  const [searching, setSearching]   = useState(false);
  const [lookup, setLookup]         = useState<LookupResult | null>(null);
  const [searched, setSearched]     = useState(false);

  const [planId, setPlanId]           = useState("starter");
  const [memoryId, setMemoryId]       = useState("free");
  const [retentionId, setRetentionId] = useState("standard");

  const [creating, setCreating] = useState(false);
  const [order, setOrder]       = useState<CreateResult | null>(null);
  const [status, setStatus]     = useState<StatusResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalThb =
    (PLAN_OPTIONS.find((p) => p.id === planId)?.priceThb ?? 0) +
    (MEMORY_OPTIONS.find((m) => m.id === memoryId)?.priceThb ?? 0) +
    (RETENTION_OPTIONS.find((r) => r.id === retentionId)?.priceThb ?? 0);

  async function handleSearch() {
    setSearching(true);
    setSearched(false);
    setLookup(null);
    setOrder(null);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscribe-for-customer/lookup?email=${encodeURIComponent(email.trim())}`);
      const data: LookupResult = await res.json();
      setLookup(data);
    } catch {
      setLookup({ found: false });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscribe-for-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), planId, memoryId, retentionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "server_error");
        return;
      }
      setOrder(data as CreateResult);
    } catch {
      setError("server_error");
    } finally {
      setCreating(false);
    }
  }

  // Poll payment status while an order is pending
  useEffect(() => {
    if (!order || status?.subscriptionStatus === "active") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/subscribe-for-customer/status?session_id=${order.sessionId}`);
        const data: StatusResult = await res.json();
        setStatus(data);
      } catch { /* keep polling */ }
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  useEffect(() => {
    if (status?.subscriptionStatus === "active" && pollRef.current) {
      clearInterval(pollRef.current);
    }
  }, [status]);

  const isActive = status?.subscriptionStatus === "active";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">สมัครแพ็กเกจแทนลูกค้า</h1>
        <p className="text-sm text-text-muted mt-0.5">
          ค้นหาลูกค้าด้วยอีเมล Google ที่ผูกกับบัญชี Zudobot แล้วสร้างลิงก์ชำระเงินผ่าน PromptPay ส่งให้ลูกค้า
        </p>
      </div>

      {/* Step 1: find customer */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">ขั้นตอนที่ 1 — ค้นหาลูกค้า</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="customer@gmail.com"
            className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
          />
          <button
            onClick={handleSearch}
            disabled={!email.trim().includes("@") || searching}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white disabled:opacity-50"
          >
            {searching ? <Spinner /> : "ค้นหา"}
          </button>
        </div>

        {searched && lookup && !lookup.found && (
          <p className="text-sm text-red-600">
            ไม่พบลูกค้าอีเมลนี้ในระบบ — ลูกค้าต้องสมัครและเข้าสู่ระบบด้วย Google ก่อน จึงจะสมัครแพ็กเกจแทนได้
          </p>
        )}

        {lookup?.found && (
          <div className="bg-surface-secondary rounded-xl p-3 text-sm">
            <p className="text-text-primary font-medium">{lookup.name || lookup.email}</p>
            <p className="text-text-muted text-xs mt-0.5">
              {lookup.email} · แพ็กเกจปัจจุบัน: {lookup.currentPlanId} ({lookup.currentStatus})
            </p>
          </div>
        )}
      </div>

      {/* Step 2: pick plan */}
      {lookup?.found && !order && (
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">ขั้นตอนที่ 2 — เลือกแพ็กเกจ</p>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs text-text-muted mb-1">แพ็กเกจ</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {PLAN_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Memory</label>
              <select value={memoryId} onChange={(e) => setMemoryId(e.target.value)}
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {MEMORY_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Retention</label>
              <select value={retentionId} onChange={(e) => setRetentionId(e.target.value)}
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-2 py-2">
                {RETENTION_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-default">
            <div>
              <p className="text-xs text-text-muted">ยอดโดยประมาณ (ไม่รวม VAT/WHT — ยอดจริงคำนวณฝั่งเซิร์ฟเวอร์)</p>
              <p className="text-lg font-bold text-brand-600">฿{totalThb.toLocaleString()}</p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 text-white disabled:opacity-50"
            >
              {creating ? <Spinner /> : "สร้างลิงก์ชำระเงินและส่งอีเมล"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">เกิดข้อผิดพลาด: {error}</p>}
        </div>
      )}

      {/* Step 3: waiting for payment */}
      {order && (
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">ขั้นตอนที่ 3 — รอลูกค้าชำระเงิน</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">ส่งลิงก์ชำระเงินไปที่ <strong>{order.customerEmail}</strong> แล้ว</p>
              <p className="text-lg font-bold text-brand-600 mt-1">฿{order.totalThb.toLocaleString()}</p>
            </div>
            {isActive ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                ชำระเงินสำเร็จ — เปิดใช้งานแล้ว
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Spinner /> รอชำระเงิน
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              readOnly
              value={order.checkoutUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-xs text-text-muted"
            />
            <button
              onClick={() => navigator.clipboard.writeText(order.checkoutUrl)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface-secondary border border-border-default"
            >
              คัดลอกลิงก์
            </button>
          </div>

          {isActive && (
            <button
              onClick={() => { setOrder(null); setStatus(null); setLookup(null); setEmail(""); setSearched(false); }}
              className="text-sm text-brand-600 font-semibold"
            >
              สมัครให้ลูกค้ารายถัดไป →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
