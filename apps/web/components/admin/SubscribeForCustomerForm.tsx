"use client";

import { useEffect, useRef, useState } from "react";

const PLAN_OPTIONS = [
  { id: "starter", label: "Starter", priceThb: 990 },
  { id: "pro",      label: "Pro",     priceThb: 1990 },
  { id: "master",   label: "Master",  priceThb: 14990 },
];
const MEMORY_OPTIONS = [
  { id: "free",   label: "Free (1 MB)", priceThb: 0 },
  { id: "small",  label: "50 MB",       priceThb: 149 },
  { id: "medium", label: "250 MB",      priceThb: 399 },
  { id: "large",  label: "1 GB+",       priceThb: 999 },
];
const RETENTION_OPTIONS = [
  { id: "standard", label: "7 วัน",   priceThb: 0 },
  { id: "1month",   label: "1 เดือน", priceThb: 99 },
  { id: "3months",  label: "3 เดือน", priceThb: 199 },
  { id: "6months",  label: "6 เดือน", priceThb: 299 },
];

interface ReadyPackage {
  _id:              string;
  name:             string;
  isTrial:          boolean;
  finalRetailPrice: number;
}

interface CreateResult {
  ok:            boolean;
  free?:         boolean;
  planName?:     string;
  sessionId?:    string;
  checkoutUrl?:  string;
  totalThb?:     number;
  customerEmail: string;
}
interface StatusResult {
  paymentStatus:      string;
  subscriptionStatus: string | null;
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block" />;
}

/**
 * Package picker → creates a Stripe PromptPay Checkout (or activates a free
 * ready package immediately) on behalf of an (already resolved) customer,
 * emails them the link, and polls payment status in real time. Shared by the
 * admin "subscribe for customer" page and the "create tenant" page.
 */
export function SubscribeForCustomerForm({ email, name }: { email: string; name?: string }) {
  const [mode, setMode] = useState<"ready" | "custom">("ready");

  const [readyPackages, setReadyPackages]     = useState<ReadyPackage[] | null>(null);
  const [readyPackageId, setReadyPackageId]   = useState("");

  const [planId, setPlanId]           = useState("starter");
  const [memoryId, setMemoryId]       = useState("free");
  const [retentionId, setRetentionId] = useState("standard");

  const [creating, setCreating] = useState(false);
  const [order, setOrder]       = useState<CreateResult | null>(null);
  const [status, setStatus]     = useState<StatusResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/public/ready-packages")
      .then((r) => r.json())
      .then((d) => {
        const pkgs: ReadyPackage[] = [...(d.trialPackages ?? []), ...(d.mainPackages ?? [])];
        setReadyPackages(pkgs);
        if (pkgs.length > 0) setReadyPackageId(pkgs[0]._id);
      })
      .catch(() => setReadyPackages([]));
  }, []);

  const selectedReadyPackage = readyPackages?.find((p) => p._id === readyPackageId) ?? null;
  const readyPackageIsFree   = !!selectedReadyPackage && selectedReadyPackage.finalRetailPrice <= 0;

  const customTotalThb =
    (PLAN_OPTIONS.find((p) => p.id === planId)?.priceThb ?? 0) +
    (MEMORY_OPTIONS.find((m) => m.id === memoryId)?.priceThb ?? 0) +
    (RETENTION_OPTIONS.find((r) => r.id === retentionId)?.priceThb ?? 0);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const body = mode === "ready"
        ? { email, readyPackageId }
        : { email, planId, memoryId, retentionId };
      const res = await fetch("/api/admin/subscribe-for-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  useEffect(() => {
    if (!order || order.free || !order.sessionId || status?.subscriptionStatus === "active") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/subscribe-for-customer/status?session_id=${order.sessionId}`);
        setStatus(await res.json());
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

  const isActive = order?.free || status?.subscriptionStatus === "active";

  // ── Free package activated — no payment, no polling ─────────────────────
  if (order?.free) {
    return (
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-2">
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">เปิดใช้งานสำเร็จ</p>
        <p className="text-sm text-text-primary">
          เปิดใช้งานแพ็กเกจ <strong>{order.planName}</strong> ให้ <strong>{order.customerEmail}</strong> แล้ว — ไม่มีค่าใช้จ่าย
        </p>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          ใช้งานได้ทันที
        </span>
      </div>
    );
  }

  // ── Paid order created — waiting for / confirming payment ───────────────
  if (order) {
    return (
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">รอลูกค้าชำระเงิน</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary">ส่งลิงก์ชำระเงินไปที่ <strong>{order.customerEmail}</strong> แล้ว</p>
            <p className="text-lg font-bold text-brand-600 mt-1">฿{(order.totalThb ?? 0).toLocaleString()}</p>
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
            onClick={() => navigator.clipboard.writeText(order.checkoutUrl ?? "")}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface-secondary border border-border-default"
          >
            คัดลอกลิงก์
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">เลือกแพ็กเกจ{name ? ` — ${name}` : ""}</p>
        <div className="flex rounded-lg border border-border-default overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setMode("ready")}
            className={`px-3 py-1.5 ${mode === "ready" ? "bg-brand-500 text-white" : "bg-surface-secondary text-text-muted"}`}
          >
            แพ็กเกจสำเร็จรูป
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`px-3 py-1.5 ${mode === "custom" ? "bg-brand-500 text-white" : "bg-surface-secondary text-text-muted"}`}
          >
            กำหนดเอง
          </button>
        </div>
      </div>

      {mode === "ready" ? (
        <div className="text-sm">
          <label className="block text-xs text-text-muted mb-1">แพ็กเกจสำเร็จรูป</label>
          {readyPackages === null ? (
            <p className="text-xs text-text-muted">กำลังโหลดแพ็กเกจ...</p>
          ) : readyPackages.length === 0 ? (
            <p className="text-xs text-text-muted">ไม่มีแพ็กเกจสำเร็จรูปที่เปิดขายอยู่ — ใช้โหมด &quot;กำหนดเอง&quot; แทน</p>
          ) : (
            <select
              value={readyPackageId}
              onChange={(e) => setReadyPackageId(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2"
            >
              {readyPackages.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.finalRetailPrice > 0 ? `฿${p.finalRetailPrice.toLocaleString()}` : "ฟรี"}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
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
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border-default">
        <div>
          <p className="text-xs text-text-muted">ยอดโดยประมาณ (ไม่รวม VAT/WHT — ยอดจริงคำนวณฝั่งเซิร์ฟเวอร์)</p>
          <p className="text-lg font-bold text-brand-600">
            {mode === "ready"
              ? (readyPackageIsFree ? "ฟรี" : `฿${(selectedReadyPackage?.finalRetailPrice ?? 0).toLocaleString()}`)
              : `฿${customTotalThb.toLocaleString()}`}
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || (mode === "ready" && !readyPackageId)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 text-white disabled:opacity-50"
        >
          {creating
            ? <Spinner />
            : (mode === "ready" && readyPackageIsFree ? "เปิดใช้งานฟรีทันที" : "สร้างลิงก์ชำระเงินและส่งอีเมล")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">เกิดข้อผิดพลาด: {error}</p>}
    </div>
  );
}
