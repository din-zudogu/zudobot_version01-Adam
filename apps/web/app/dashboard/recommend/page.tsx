"use client";

import { useState, useEffect, useCallback } from "react";

interface Tier {
  id: string;
  minPoints: number;
  maxPoints: number | null;
  costPoints: number;
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
  label: string;
  eligible: boolean;
}

interface Invite {
  id: string;
  inviteeEmail: string;
  shopName: string | null;
  status: "sent" | "signed_up" | "installed" | "expired";
  pointsAwarded: boolean;
  createdAt: string;
}

interface Summary {
  balance: number;
  cycleStart: string;
  cycleEnd: string;
  tiers: Tier[];
  activeRedemption: { tierId: string; label: string; pointsSpent: number; redeemedAt: string } | null;
  invites: Invite[];
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const STATUS_LABEL: Record<Invite["status"], string> = {
  sent: "ส่งคำเชิญแล้ว รอเพื่อนสมัคร",
  signed_up: "เพื่อนสมัครแล้ว รอติดตั้งบนเว็บไซต์",
  installed: "ติดตั้งสำเร็จ — ได้รับคะแนนแล้ว",
  expired: "คำเชิญหมดอายุ",
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function RecommendPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/tenant/recommend")
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSent(false);
    setSending(true);
    try {
      const res = await fetch("/api/tenant/recommend/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          invalid_email: "อีเมลไม่ถูกต้อง",
          cannot_refer_self: "ไม่สามารถแนะนำตัวเองได้",
          already_invited: "คุณส่งคำเชิญให้อีเมลนี้ไปแล้ว และยังไม่หมดอายุ",
        };
        throw new Error(msgs[data.error] ?? "ส่งคำเชิญไม่สำเร็จ");
      }
      setEmail("");
      setInviteSent(true);
      load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "ส่งคำเชิญไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function redeem(tierId: string) {
    setRedeemError(null);
    setRedeemingId(tierId);
    try {
      const res = await fetch("/api/tenant/recommend/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          insufficient_points: "คะแนนไม่พอสำหรับสิทธิพิเศษนี้",
          inactive_tier: "สิทธิพิเศษนี้ปิดใช้งานอยู่",
        };
        throw new Error(msgs[data.error] ?? "แลกสิทธิ์ไม่สำเร็จ");
      }
      load();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "แลกสิทธิ์ไม่สำเร็จ");
    } finally {
      setRedeemingId(null);
    }
  }

  if (loading || !summary) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">บอกต่อ</h1>
        <p className="text-sm text-text-muted mt-0.5">
          แนะนำเพื่อนให้มาใช้งาน ZUDOBOT รับ 50 คะแนนต่อ 1 ร้านค้าที่แนะนำสำเร็จ
        </p>
      </div>

      {/* Points summary */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text-secondary">คะแนนสะสมของคุณ (รอบปีปัจจุบัน)</p>
            <p className="text-3xl font-bold text-brand-600 mt-1">{summary.balance.toLocaleString("th-TH")} คะแนน</p>
          </div>
          {summary.activeRedemption && (
            <div className="text-right">
              <p className="text-xs font-semibold text-text-secondary">สิทธิพิเศษที่ใช้งานอยู่</p>
              <p className="text-sm font-bold text-green-600 mt-1">{summary.activeRedemption.label}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-text-muted">
          คะแนนสะสมได้ 1 ปี นับจากวันที่สมัครใช้งาน ({formatDate(summary.cycleStart)} – {formatDate(summary.cycleEnd)}) คะแนนที่ไม่ได้ใช้จะถูกรีเซ็ตเมื่อครบรอบปี
        </p>
      </div>

      {/* Invite form */}
      <form onSubmit={sendInvite} className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <p className="text-sm font-bold text-text-primary">ส่งคำเชิญให้เพื่อน</p>
        <p className="text-xs text-text-muted -mt-2">
          ระบบจะส่งอีเมลแนะนำ ZUDOBOT พร้อมลิงก์สมัครและรหัสยืนยันเฉพาะบุคคลไปยังอีเมลนี้ —
          คุณจะได้รับ 50 คะแนน เมื่อเพื่อนสมัครด้วยอีเมลนี้และติดตั้งวิดเจ็ตบนเว็บไซต์ของตัวเองสำเร็จ
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setInviteSent(false); }}
            placeholder="friend@example.com"
            className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
          />
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {sending ? "กำลังส่ง..." : "ส่งคำเชิญ"}
          </button>
        </div>
        {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
        {inviteSent && <p className="text-sm text-green-600 font-medium">✓ ส่งคำเชิญแล้ว</p>}
      </form>

      {/* Reward tiers */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <p className="text-sm font-bold text-text-primary">แลกคะแนนเป็นสิทธิพิเศษ</p>
        {redeemError && <p className="text-sm text-red-500">{redeemError}</p>}
        <div className="space-y-2">
          {summary.tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between gap-4 bg-surface-secondary border border-border-default rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-text-primary">{tier.label}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  ใช้ {tier.costPoints.toLocaleString("th-TH")} คะแนน · ช่วงคะแนน {tier.minPoints.toLocaleString("th-TH")}
                  {tier.maxPoints ? `–${tier.maxPoints.toLocaleString("th-TH")}` : "+"}
                </p>
              </div>
              <button
                onClick={() => redeem(tier.id)}
                disabled={!tier.eligible || redeemingId === tier.id}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {redeemingId === tier.id ? "กำลังแลก..." : "แลกสิทธิ์"}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          เงื่อนไข: คะแนนสะสมรวม 1–50 ยังไม่ได้รับสิทธิ์ใดๆ, 51–100 ได้ AI Token +10 ประโยค, 101–250 ได้ +20 ประโยค,
          251–500 ได้ +20 ประโยค และจดจำบทสนทนา +7 วัน, 501–700 ได้ +30 ประโยค และจดจำบทสนทนา +14 วัน,
          701–1000 ได้ +30 ประโยค จดจำบทสนทนา +30 วัน และหน่วยความจำ +4MB — แลกสิทธิ์แล้วคะแนนจะถูกหักตามที่ใช้
        </p>
      </div>

      {/* Sent invites list */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-3">
        <p className="text-sm font-bold text-text-primary">รายชื่อที่คุณแนะนำ</p>
        {summary.invites.length === 0 ? (
          <p className="text-sm text-text-muted">ยังไม่มีการส่งคำเชิญ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-border-default">
                  <th className="py-2 pr-4 font-semibold">อีเมล</th>
                  <th className="py-2 pr-4 font-semibold">ชื่อร้านค้า</th>
                  <th className="py-2 pr-4 font-semibold">สถานะ</th>
                  <th className="py-2 pr-4 font-semibold">วันที่ส่ง</th>
                </tr>
              </thead>
              <tbody>
                {summary.invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-border-default last:border-0">
                    <td className="py-2.5 pr-4 text-text-primary">{inv.inviteeEmail}</td>
                    <td className="py-2.5 pr-4 text-text-secondary">{inv.shopName ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className={inv.status === "installed" ? "text-green-600 font-medium" : "text-text-secondary"}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-text-muted">{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
