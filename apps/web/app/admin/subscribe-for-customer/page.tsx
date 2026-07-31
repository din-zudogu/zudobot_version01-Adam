"use client";

import { useState } from "react";
import { SubscribeForCustomerForm } from "@/components/admin/SubscribeForCustomerForm";

interface LookupResult {
  found:         boolean;
  tenantId?:     string;
  name?:         string;
  email?:        string;
  currentPlanId?: string;
  currentStatus?: string;
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />;
}

export default function SubscribeForCustomerPage() {
  const [email, setEmail]           = useState("");
  const [searching, setSearching]   = useState(false);
  const [lookup, setLookup]         = useState<LookupResult | null>(null);
  const [searched, setSearched]     = useState(false);

  async function handleSearch() {
    setSearching(true);
    setSearched(false);
    setLookup(null);
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
            (หรือใช้เมนู &quot;สร้างบัญชีลูกค้าใหม่&quot; เพื่อสร้างบัญชีให้ก่อน)
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

      {/* Step 2-3: pick plan, pay, poll status */}
      {lookup?.found && lookup.email && (
        <SubscribeForCustomerForm email={lookup.email} name={lookup.name} />
      )}
    </div>
  );
}
