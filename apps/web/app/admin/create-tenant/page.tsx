"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SubscribeForCustomerForm } from "@/components/admin/SubscribeForCustomerForm";

interface CreateResult {
  tenantId: string;
  email:    string;
  name:     string;
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />;
}

const BUSINESS_TYPES = ["ร้านค้าออนไลน์", "บริการ", "การศึกษา", "อสังหาริมทรัพย์", "อื่นๆ"];

export default function CreateTenantPage() {
  const { update } = useSession();
  const router      = useRouter();

  const [email, setEmail]               = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [creating, setCreating]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<CreateResult | null>(null);
  const [viewing, setViewing]           = useState(false);

  const canSubmit = email.trim().includes("@") && businessName.trim().length > 0;

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), businessName: businessName.trim(), businessType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "email_already_exists"
            ? "อีเมลนี้มีบัญชีอยู่แล้ว — ใช้เมนู \"สมัครแพ็กเกจแทนลูกค้า\" แทน"
            : (data.error ?? "server_error")
        );
        return;
      }
      setResult(data as CreateResult);
    } catch {
      setError("server_error");
    } finally {
      setCreating(false);
    }
  }

  async function handleViewDashboard() {
    if (!result) return;
    setViewing(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId: result.tenantId }),
      });
      const data = await res.json();
      if (!data.ok) { setViewing(false); return; }
      await update({ action: "impersonate", tenantId: data.tenantId, clientName: data.clientName });
      router.push("/dashboard/overview");
    } catch {
      setViewing(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">สร้างบัญชีลูกค้าใหม่</h1>
        <p className="text-sm text-text-muted mt-0.5">
          สร้างบัญชี Zudobot แทนลูกค้าด้วยอีเมล Google ของลูกค้า — เมื่อสร้างสำเร็จ ลูกค้าเข้าสู่ระบบด้วย Google ได้ทันที ไม่ต้องสมัครใหม่
        </p>
      </div>

      {!result && (
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">อีเมล Google ของลูกค้า</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@gmail.com"
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">ชื่อธุรกิจ</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="ร้านตัวอย่าง"
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">ประเภทธุรกิจ</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm"
            >
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={!canSubmit || creating}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 text-white disabled:opacity-50"
          >
            {creating ? <Spinner /> : "สร้างบัญชี"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {result && (
        <>
          <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">สร้างบัญชีสำเร็จ</p>
            <p className="text-sm text-text-primary">
              <strong>{result.name}</strong> ({result.email}) — เริ่มต้นด้วย Trial 14 วัน ส่งอีเมลแจ้งลูกค้าให้เข้าสู่ระบบด้วย Google แล้ว
            </p>
            <button
              onClick={handleViewDashboard}
              disabled={viewing}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50"
            >
              {viewing ? "กำลังเข้าดู…" : "View Dashboard →"}
            </button>
          </div>

          <SubscribeForCustomerForm email={result.email} name={result.name} />
        </>
      )}
    </div>
  );
}
