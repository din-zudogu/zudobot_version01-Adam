"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────

interface ActivityInvite {
  id: string;
  inviteeEmail: string;
  shopName: string | null;
  status: "sent" | "signed_up" | "installed" | "expired";
  pointsAwarded: boolean;
  createdAt: string;
}
interface ReferrerGroup {
  referrerTenantId: string;
  referrerEmail: string;
  referrerShopName: string;
  invites: ActivityInvite[];
}

interface RuleRow {
  id: string;
  eventType: string;
  packageId: string | null;
  points: number;
  label: string;
  isActive: boolean;
}

interface TierRow {
  id: string;
  minPoints: number;
  maxPoints: number | null;
  costPoints: number;
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

// ── Activity tab ─────────────────────────────────────────────────

function ActivityTab() {
  const [groups, setGroups] = useState<ReferrerGroup[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/recommend/activity")
      .then((r) => r.json())
      .then((d) => setGroups(d.referrers ?? []))
      .catch(() => setGroups([]));
  }, []);

  if (!groups) return <Spinner />;
  if (groups.length === 0) return <p className="text-sm text-text-muted">ยังไม่มีร้านค้าใดส่งคำเชิญบอกต่อ</p>;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.referrerTenantId} className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-text-primary">{g.referrerShopName || "(ไม่มีชื่อร้าน)"}</p>
              <p className="text-xs text-text-muted">{g.referrerEmail}</p>
            </div>
            <span className="text-xs text-text-muted">{g.invites.length} คำเชิญ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-border-default">
                  <th className="py-1.5 pr-4 font-semibold">อีเมลที่แนะนำ</th>
                  <th className="py-1.5 pr-4 font-semibold">ชื่อร้านค้า</th>
                  <th className="py-1.5 pr-4 font-semibold">สถานะ</th>
                  <th className="py-1.5 pr-4 font-semibold">วันที่ส่ง</th>
                </tr>
              </thead>
              <tbody>
                {g.invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-border-default last:border-0">
                    <td className="py-2 pr-4 text-text-primary">{inv.inviteeEmail}</td>
                    <td className="py-2 pr-4 text-text-secondary">{inv.shopName ?? "—"}</td>
                    <td className="py-2 pr-4 text-text-secondary">{inv.status}{inv.pointsAwarded ? " ✓" : ""}</td>
                    <td className="py-2 pr-4 text-text-muted">{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rules tab ────────────────────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ eventType: "plan_signup", packageId: "", points: 0, label: "" });

  const load = useCallback(() => {
    fetch("/api/admin/recommend/rules").then((r) => r.json()).then((d) => setRules(d.rules ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(rule: RuleRow) {
    setSaving(rule.id);
    await fetch("/api/admin/recommend/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, points: rule.points, label: rule.label, isActive: rule.isActive, packageId: rule.packageId }),
    });
    setSaving(null);
    load();
  }

  async function addRule() {
    if (!newRule.label.trim()) return;
    await fetch("/api/admin/recommend/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newRule, packageId: newRule.packageId || null }),
    });
    setNewRule({ eventType: "plan_signup", packageId: "", points: 0, label: "" });
    load();
  }

  if (!rules) return <Spinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        packageId ใช้จับคู่กับ PackageConfig / แพ็กเกจจริงที่ตั้งไว้ในระบบ — แก้ไขให้ตรงกับชื่อแพ็กเกจที่ใช้งานจริงได้ที่นี่
      </p>
      <div className="overflow-x-auto bg-surface-primary border border-border-default rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-muted border-b border-border-default">
              <th className="py-2 px-3 font-semibold">Event Type</th>
              <th className="py-2 px-3 font-semibold">Package ID</th>
              <th className="py-2 px-3 font-semibold">คะแนน</th>
              <th className="py-2 px-3 font-semibold">คำอธิบาย</th>
              <th className="py-2 px-3 font-semibold">เปิดใช้งาน</th>
              <th className="py-2 px-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id} className="border-b border-border-default last:border-0">
                <td className="py-2 px-3 text-text-secondary">{r.eventType}</td>
                <td className="py-2 px-3">
                  <input
                    value={r.packageId ?? ""}
                    onChange={(e) => setRules((rs) => rs!.map((x, j) => (j === i ? { ...x, packageId: e.target.value } : x)))}
                    className="w-40 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={r.points}
                    onChange={(e) => setRules((rs) => rs!.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))}
                    className="w-20 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    value={r.label}
                    onChange={(e) => setRules((rs) => rs!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="w-64 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => setRules((rs) => rs!.map((x, j) => (j === i ? { ...x, isActive: e.target.checked } : x)))}
                  />
                </td>
                <td className="py-2 px-3">
                  <button
                    onClick={() => save(r)}
                    disabled={saving === r.id}
                    className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {saving === r.id ? "..." : "บันทึก"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-primary border border-border-default rounded-2xl p-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Event Type</label>
          <select
            value={newRule.eventType}
            onChange={(e) => setNewRule((r) => ({ ...r, eventType: e.target.value }))}
            className="bg-surface-secondary border border-border-default rounded-lg px-2 py-1.5 text-xs"
          >
            {["referral", "plan_signup", "plan_renewal", "addon_purchase", "addon_renewal"].map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Package ID (เว้นว่าง = referral)</label>
          <input value={newRule.packageId} onChange={(e) => setNewRule((r) => ({ ...r, packageId: e.target.value }))} className="w-40 bg-surface-secondary border border-border-default rounded-lg px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="block text-[11px] text-text-muted mb-1">คะแนน</label>
          <input type="number" value={newRule.points} onChange={(e) => setNewRule((r) => ({ ...r, points: Number(e.target.value) }))} className="w-20 bg-surface-secondary border border-border-default rounded-lg px-2 py-1.5 text-xs" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-text-muted mb-1">คำอธิบาย</label>
          <input value={newRule.label} onChange={(e) => setNewRule((r) => ({ ...r, label: e.target.value }))} className="w-full bg-surface-secondary border border-border-default rounded-lg px-2 py-1.5 text-xs" />
        </div>
        <button onClick={addRule} className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold">+ เพิ่มกฎ</button>
      </div>
    </div>
  );
}

// ── Tiers tab ────────────────────────────────────────────────────

function TiersTab() {
  const [tiers, setTiers] = useState<TierRow[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/recommend/tiers").then((r) => r.json()).then((d) => setTiers(d.tiers ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(tier: TierRow) {
    setSaving(tier.id);
    await fetch("/api/admin/recommend/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tier),
    });
    setSaving(null);
    load();
  }

  if (!tiers) return <Spinner />;

  return (
    <div className="overflow-x-auto bg-surface-primary border border-border-default rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-muted border-b border-border-default">
            <th className="py-2 px-3 font-semibold">คะแนนขั้นต่ำ</th>
            <th className="py-2 px-3 font-semibold">คะแนนสูงสุด</th>
            <th className="py-2 px-3 font-semibold">คะแนนที่ใช้แลก</th>
            <th className="py-2 px-3 font-semibold">Token +ประโยค</th>
            <th className="py-2 px-3 font-semibold">จดจำ +วัน</th>
            <th className="py-2 px-3 font-semibold">หน่วยความจำ +MB</th>
            <th className="py-2 px-3 font-semibold">คำอธิบาย</th>
            <th className="py-2 px-3 font-semibold">เปิดใช้งาน</th>
            <th className="py-2 px-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => {
            const set = (patch: Partial<TierRow>) =>
              setTiers((ts) => ts!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <tr key={t.id} className="border-b border-border-default last:border-0">
                <td className="py-2 px-3"><input type="number" value={t.minPoints} onChange={(e) => set({ minPoints: Number(e.target.value) })} className="w-20 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="number" value={t.maxPoints ?? ""} onChange={(e) => set({ maxPoints: e.target.value ? Number(e.target.value) : null })} className="w-20 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="number" value={t.costPoints} onChange={(e) => set({ costPoints: Number(e.target.value) })} className="w-20 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="number" value={t.bonusMsgPerMonth} onChange={(e) => set({ bonusMsgPerMonth: Number(e.target.value) })} className="w-16 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="number" value={t.bonusRetentionDays} onChange={(e) => set({ bonusRetentionDays: Number(e.target.value) })} className="w-16 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="number" value={t.bonusMemoryMb} onChange={(e) => set({ bonusMemoryMb: Number(e.target.value) })} className="w-16 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input value={t.label} onChange={(e) => set({ label: e.target.value })} className="w-56 bg-surface-secondary border border-border-default rounded-lg px-2 py-1 text-xs" /></td>
                <td className="py-2 px-3"><input type="checkbox" checked={t.isActive} onChange={(e) => set({ isActive: e.target.checked })} /></td>
                <td className="py-2 px-3">
                  <button onClick={() => save(t)} disabled={saving === t.id} className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50">
                    {saving === t.id ? "..." : "บันทึก"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

const TABS = [
  { id: "activity", label: "กิจกรรมบอกต่อ" },
  { id: "rules", label: "กฎการให้คะแนน" },
  { id: "tiers", label: "สิทธิพิเศษตามคะแนน" },
] as const;

export default function AdminRecommendPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("activity");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">โปรแกรมบอกต่อ (Recommend)</h1>
        <p className="text-sm text-text-muted mt-0.5">ดูกิจกรรมการแนะนำของทุกร้านค้า และตั้งค่ากฎการให้คะแนน/สิทธิพิเศษ</p>
      </div>

      <div className="flex gap-2 border-b border-border-default">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? "border-brand-600 text-brand-600" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "activity" && <ActivityTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "tiers" && <TiersTab />}
    </div>
  );
}
