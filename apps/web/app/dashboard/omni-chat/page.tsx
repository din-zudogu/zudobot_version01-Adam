"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlatformName = "line" | "facebook" | "instagram" | "tiktok";

interface ChannelsData {
  websiteUrl: string;
  line:    { enabled: boolean; hasChannelSecret: boolean; hasChannelToken: boolean; webhookUrl: string };
  meta:    { enabled: boolean; hasPageAccessToken: boolean; pageId: string; webhookUrl: string };
  tiktok:  { enabled: boolean; hasAccessToken: boolean; hasWebhookSecret: boolean; webhookUrl: string };
}

interface ActivityRow {
  platformName:   PlatformName;
  displayName:    string;
  initialMessage: string;
  expiresAt:      string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<PlatformName, { label: string; color: string; bg: string; icon: string }> = {
  line:      { label: "LINE OA",    color: "text-green-700",  bg: "bg-green-50",   icon: "💬" },
  facebook:  { label: "Facebook",   color: "text-blue-700",   bg: "bg-blue-50",    icon: "📘" },
  instagram: { label: "Instagram",  color: "text-pink-700",   bg: "bg-pink-50",    icon: "📸" },
  tiktok:    { label: "TikTok",     color: "text-slate-700",  bg: "bg-slate-100",  icon: "🎵" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "หมดอายุแล้ว";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
      className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-border-default bg-white hover:bg-surface-secondary transition-colors font-medium"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
      ${ok ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
      {label}
    </span>
  );
}

// ── My Channels Tab ───────────────────────────────────────────────────────────

function MyChannelsTab() {
  const [data,    setData]    = useState<ChannelsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/channels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ChannelsData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data)   return <p className="text-sm text-red-500 py-8">โหลดข้อมูลไม่สำเร็จ</p>;

  const platforms: { key: PlatformName; connected: boolean; enabled: boolean; webhookUrl: string; pageId?: string }[] = [
    { key: "line",      connected: data.line.hasChannelSecret && data.line.hasChannelToken, enabled: data.line.enabled,            webhookUrl: data.line.webhookUrl },
    { key: "facebook",  connected: data.meta.hasPageAccessToken,                             enabled: data.meta.enabled,            webhookUrl: data.meta.webhookUrl, pageId: data.meta.pageId },
    { key: "instagram", connected: data.meta.hasPageAccessToken,                             enabled: data.meta.enabled,            webhookUrl: data.meta.webhookUrl },
    { key: "tiktok",    connected: data.tiktok.hasAccessToken && data.tiktok.hasWebhookSecret, enabled: data.tiktok.enabled,        webhookUrl: data.tiktok.webhookUrl },
  ];

  const anyConnected = platforms.some((p) => p.connected);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {platforms.map((p) => {
          const meta = PLATFORM_META[p.key];
          return (
            <div key={p.key} className={`rounded-xl border border-border-default p-3 ${meta.bg}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span>{meta.icon}</span>
                <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
              <StatusPill ok={p.connected && p.enabled} label={p.connected && p.enabled ? "Live" : p.connected ? "ตั้งค่าแล้ว" : "ยังไม่เชื่อม"} />
            </div>
          );
        })}
      </div>

      {/* Webhook URLs */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-text-primary">📎 Webhook URLs</p>
        <p className="text-xs text-text-muted">นำ URL เหล่านี้ไปตั้งค่าใน Developer Console ของแต่ละ platform</p>
        {[
          { label: "LINE",               url: data.line.webhookUrl,  icon: "💬" },
          { label: "Facebook/Instagram", url: data.meta.webhookUrl,  icon: "📘" },
          { label: "TikTok",             url: data.tiktok.webhookUrl, icon: "🎵" },
        ].map((row) => (
          <div key={row.label} className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">{row.icon} {row.label}</p>
            <div className="flex items-center gap-2 bg-slate-50 border border-border-default rounded-xl px-3 py-2">
              <code className="text-xs font-mono text-text-muted flex-1 break-all select-all">{row.url}</code>
              <CopyBtn value={row.url} />
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {!anyConnected && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-800">ยังไม่ได้เชื่อมต่อ platform ใดเลย</p>
            <p className="text-xs text-brand-600 mt-0.5">เชื่อม LINE, Facebook หรือ TikTok เพื่อรับข้อความจากลูกค้ามายัง Zudobot Widget</p>
          </div>
          <Link href="/dashboard/channels"
            className="shrink-0 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">
            ตั้งค่าช่องทาง →
          </Link>
        </div>
      )}
      {anyConnected && (
        <div className="text-right">
          <Link href="/dashboard/channels"
            className="text-xs text-brand-600 hover:underline font-medium">
            แก้ไขการตั้งค่าช่องทาง →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Live Activity Tab ─────────────────────────────────────────────────────────

function LiveActivityTab() {
  const [rows,    setRows]    = useState<ActivityRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/tenant/omni-chat?tab=activity&page=${page}`, { cache: "no-store" });
      const data = await res.json() as { total: number; rows: ActivityRow[] };
      setRows(data.rows);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  // Refresh every 15s + tick every 1s for countdown
  useEffect(() => {
    const refresh = setInterval(() => void load(), 15_000);
    const tick    = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, [load]);

  const pages = Math.ceil(total / 20);

  if (loading && rows.length === 0) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Active deep-link tokens: <span className="font-semibold text-text-primary">{total}</span>
        </p>
        <button onClick={() => void load()} className="text-xs text-brand-600 hover:underline">
          🔄 รีเฟรช
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface-primary border border-border-default rounded-2xl py-16 text-center">
          <p className="text-text-muted text-sm">ไม่มี active token ขณะนี้</p>
          <p className="text-xs text-text-muted mt-1">Token จะปรากฏเมื่อลูกค้าส่งข้อความมาจาก platform</p>
        </div>
      ) : (
        <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                {["Platform","ลูกค้า","ข้อความ","หมดอายุใน"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide ${h === "หมดอายุใน" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pMeta = PLATFORM_META[row.platformName] ?? PLATFORM_META.line;
                const left  = timeLeft(row.expiresAt);
                const urgent = left !== "หมดอายุแล้ว" && left.endsWith("s");
                return (
                  <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-secondary/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${pMeta.bg} ${pMeta.color}`}>
                        {pMeta.icon} {pMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.displayName || <span className="italic text-text-muted">ไม่ระบุ</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary max-w-[200px]">
                      <span className="truncate block" title={row.initialMessage}>{row.initialMessage}</span>
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-mono font-semibold ${urgent ? "text-orange-600" : "text-text-muted"}`}>
                      {left}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors">
            ← ก่อนหน้า
          </button>
          <span>หน้า {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors">
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Guides Tab (same content as admin) ────────────────────────────────────────

function GuideStep({ n, icon, title, children }: { n: number; icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{n}</div>
        <div className="w-px flex-1 bg-border-default mt-1 mb-1" />
      </div>
      <div className="pb-5">
        <div className="flex items-center gap-1.5 mb-1">
          <span>{icon}</span>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  );
}

function GuideSection({ icon, title, accent, children }: { icon: string; title: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border-default rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className={`w-full flex items-center gap-3 px-5 py-4 text-left ${accent}`}>
        <span className="text-2xl">{icon}</span>
        <span className="flex-1 font-bold text-base">{title}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && <div className="px-6 pt-5 pb-2 bg-surface-primary">{children}</div>}
    </div>
  );
}

function IB({ color, children }: { color: "amber"|"blue"|"green"; children: React.ReactNode }) {
  const cls = { amber: "bg-amber-50 border-amber-200 text-amber-800", blue: "bg-blue-50 border-blue-200 text-blue-800", green: "bg-green-50 border-green-200 text-green-800" }[color];
  return <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed my-3 ${cls}`}>{children}</div>;
}

function CS({ children }: { children: string }) {
  return <code className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">{children}</code>;
}

function GuidesTab() {
  return (
    <div className="space-y-5 max-w-3xl">

      <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 rounded-2xl px-5 py-4 space-y-2">
        <p className="text-sm font-bold text-brand-800">💡 วิธีการทำงานของ OmniChat</p>
        <p className="text-xs text-brand-700">
          ลูกค้าพิมพ์บน LINE / Facebook / Instagram / TikTok → Zudobot รับ webhook → สร้าง deep link →
          ลูกค้าคลิก → Widget เปิดบนเว็บ brand ของคุณ → AI ตอบ
        </p>
        <p className="text-xs text-brand-600 font-medium">
          Webhook URL รูปแบบ: <CS>{`https://yourdomain.com/api/webhooks/[platform]/[tenantId]`}</CS>
          &nbsp;— ดูได้ที่แท็บ &quot;My Channels&quot;
        </p>
      </div>

      {/* LINE */}
      <GuideSection icon="💬" title="LINE Official Account — Messaging API" accent="bg-green-50 text-green-900">
        <IB color="green"><strong>สิ่งที่ต้องมีก่อน:</strong> LINE Official Account (manager.line.biz) + LINE account สำหรับ login</IB>
        <GuideStep n={1} icon="🌐" title="เข้า LINE Developers Console">
          <p>ไปที่ <strong>developers.line.biz</strong> → Log in ด้วย LINE account</p>
        </GuideStep>
        <GuideStep n={2} icon="📁" title="สร้าง Provider (ถ้ายังไม่มี)">
          <p>กด <strong>Create a new provider</strong> → ตั้งชื่อ → Create</p>
        </GuideStep>
        <GuideStep n={3} icon="📱" title="สร้าง Messaging API Channel">
          <p>ใน Provider → <strong>Create a new channel</strong> → <strong>Messaging API</strong></p>
          <p>กรอก Channel name, Description, Category → Create → ผูก LINE Official Account</p>
        </GuideStep>
        <GuideStep n={4} icon="🔑" title="คัดลอก Channel Secret">
          <p>แท็บ <strong>Basic settings</strong> → <strong>Channel secret</strong> → Copy → วางใน Zudobot Dashboard → Channels</p>
          <IB color="amber">⚠️ ห้ามเผยแพร่ Channel secret — ใช้ตรวจ signature</IB>
        </GuideStep>
        <GuideStep n={5} icon="🎫" title="สร้าง Channel Access Token">
          <p>แท็บ <strong>Messaging API</strong> → <strong>Channel access token (long-lived)</strong> → Issue → Copy → วางใน Zudobot</p>
        </GuideStep>
        <GuideStep n={6} icon="🔗" title="ตั้งค่า Webhook URL">
          <p>แท็บ Messaging API → <strong>Webhook URL</strong> → Edit → วาง Webhook URL จากแท็บ &quot;My Channels&quot;</p>
          <p>กด <strong>Verify</strong> → toggle <strong>Use webhook: ON</strong></p>
          <IB color="amber">ปิด &quot;Auto-reply messages&quot; และ &quot;Greeting messages&quot; ใน LINE Official Account Manager ด้วย</IB>
        </GuideStep>
        <GuideStep n={7} icon="✨" title="(แนะนำ) สร้าง LIFF App">
          <p>Provider → แท็บ <strong>LIFF</strong> → Add → Endpoint URL: URL เว็บของคุณ → Size: Full</p>
          <p>คัดลอก LIFF ID → ใส่ใน Zudobot Dashboard → Channels → LINE → ช่อง LIFF ID</p>
        </GuideStep>
        <IB color="green"><strong>ทดสอบ:</strong> Scan QR Code ของ LINE OA → พิมพ์ข้อความ → ควรได้รับ link กลับมา</IB>
      </GuideSection>

      {/* Facebook */}
      <GuideSection icon="📘" title="Facebook Messenger" accent="bg-blue-50 text-blue-900">
        <IB color="blue">
          <strong>วิธีที่ง่ายที่สุด:</strong> ใช้ปุ่ม &quot;เชื่อมต่อด้วย Facebook&quot; ใน Channels — OAuth 1 คลิก ไม่ต้องทำขั้นตอนด้านล่าง
          <br/><br/><strong>Manual (Advanced):</strong> ทำตามขั้นตอนด้านล่าง
        </IB>
        <GuideStep n={1} icon="🌐" title="สร้าง Meta App">
          <p><strong>developers.facebook.com</strong> → My Apps → Create App → Business → กรอกชื่อ → Create</p>
        </GuideStep>
        <GuideStep n={2} icon="💬" title="เพิ่ม Messenger Product">
          <p>Dashboard → Add Product → <strong>Messenger</strong> → Set up</p>
        </GuideStep>
        <GuideStep n={3} icon="🔗" title="ตั้งค่า Webhook">
          <p>Messenger settings → Webhooks → Add Callback URL → วาง Webhook URL จากแท็บ &quot;My Channels&quot;</p>
          <p>Verify Token: ใส่ค่าเดียวกับ Zudobot → Verify and save → Subscribe ✔ <strong>messages</strong></p>
        </GuideStep>
        <GuideStep n={4} icon="🔑" title="Generate Page Access Token">
          <p>Messenger settings → Access Tokens → เลือก Page → Generate token → Copy → วางใน Zudobot</p>
        </GuideStep>
        <GuideStep n={5} icon="🔒" title="คัดลอก App Secret">
          <p>Settings → Basic → Show App secret → Copy → วางใน Zudobot</p>
        </GuideStep>
        <IB color="blue"><strong>ทดสอบ:</strong> ส่งข้อความไปที่ Facebook Page → ควรได้รับ link ตอบกลับ</IB>
      </GuideSection>

      {/* Instagram */}
      <GuideSection icon="📸" title="Instagram (ใช้ร่วมกับ Facebook App)" accent="bg-pink-50 text-pink-900">
        <IB color="blue">Instagram ใช้ Meta App เดียวกับ Facebook — ทำขั้นตอน Facebook ด้านบนก่อน แล้วเพิ่มต่อ</IB>
        <GuideStep n={1} icon="🔗" title="เชื่อม Instagram Business กับ Facebook Page">
          <p>Instagram → Settings → Switch to Professional (Business/Creator) → เชื่อมกับ Facebook Page</p>
        </GuideStep>
        <GuideStep n={2} icon="💬" title="เพิ่ม Instagram Messaging ใน Meta App">
          <p>Meta Developer → Add Product → Instagram → Set up</p>
        </GuideStep>
        <GuideStep n={3} icon="🔔" title="Subscribe Instagram Webhooks">
          <p>Webhooks → Callback URL เดิม → Subscribe ✔ <strong>instagram_messages</strong></p>
        </GuideStep>
        <IB color="blue"><strong>ทดสอบ:</strong> ส่ง DM ไปที่ Instagram Business account → ควรได้รับ link</IB>
      </GuideSection>

      {/* TikTok */}
      <GuideSection icon="🎵" title="TikTok Direct Message" accent="bg-slate-50 text-slate-900">
        <IB color="amber">⚠️ TikTok DM API ต้องผ่าน review ก่อน (ประมาณ 1-2 สัปดาห์) — ใช้ Sandbox ระหว่างรอ</IB>
        <GuideStep n={1} icon="🌐" title="สมัคร TikTok for Developers">
          <p><strong>developers.tiktok.com</strong> → Manage apps → Create app</p>
        </GuideStep>
        <GuideStep n={2} icon="✉️" title="ขอสิทธิ์ Direct Message API">
          <p>App settings → Products → Direct Message API → Add → Submit for review</p>
        </GuideStep>
        <GuideStep n={3} icon="🔗" title="ตั้งค่า Webhook">
          <p>App settings → Webhooks → Add endpoint → วาง Webhook URL จากแท็บ &quot;My Channels&quot;</p>
          <p>Events: ✔ <strong>direct_message.received</strong></p>
        </GuideStep>
        <GuideStep n={4} icon="🔑" title="คัดลอก Access Token และ Webhook Secret">
          <p><strong>Access Token:</strong> Basic information → Access token → Copy → วางใน Zudobot</p>
          <p><strong>Webhook Secret:</strong> Webhooks → Show secret → Copy → วางใน Zudobot</p>
        </GuideStep>
        <IB color="green"><strong>ทดสอบ (Sandbox):</strong> เพิ่ม tester account → ส่ง DM → ควรได้รับ link</IB>
      </GuideSection>

      {/* Troubleshooting */}
      <div className="border border-border-default rounded-2xl p-5 bg-surface-primary space-y-3">
        <p className="text-sm font-bold text-text-primary">🛠 ปัญหาที่พบบ่อย</p>
        <div className="space-y-3 text-xs">
          {[
            { q: "Webhook Verify ล้มเหลว",         a: "ตรวจสอบว่า Zudobot deploy แล้ว และ tenantId ใน URL ถูกต้อง" },
            { q: "ส่งข้อความแล้วไม่ได้รับ link",    a: "เช็คแท็บ Live Activity — ถ้าไม่มี token แสดงว่า webhook ไม่ถึง Zudobot" },
            { q: "LINE ตอบซ้ำ",                    a: "ปิด Auto-reply messages ใน LINE Official Account Manager" },
            { q: "Facebook webhook 403",            a: "App Secret ผิด หรือ Verify Token ไม่ตรง" },
            { q: "Widget ไม่เปิดอัตโนมัติ",         a: "ตรวจสอบว่าติดตั้ง Widget script บนเว็บแล้ว และ URL มี ?zudobot=1&ctx=TOKEN" },
          ].map((item, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-red-400 font-bold shrink-0">Q:</span>
              <div>
                <p className="font-semibold text-text-primary">{item.q}</p>
                <p className="text-text-muted mt-0.5">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "channels" | "activity" | "guides";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "channels",  label: "My Channels",    icon: "📡" },
  { id: "activity",  label: "Live Activity",  icon: "🔗" },
  { id: "guides",    label: "คู่มือตั้งค่า",   icon: "📖" },
];

export default function TenantOmniChatPage() {
  const [activeTab, setActiveTab] = useState<Tab>("channels");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <span className="text-2xl">🔀</span>
          OmniChat
        </h1>
        <p className="text-sm text-text-muted mt-1">
          เชื่อมต่อ LINE / Facebook / Instagram / TikTok → ลูกค้าคลิก link → Zudobot Widget เปิดบนเว็บของคุณ
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-secondary rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-white text-brand-700 shadow-sm"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "channels"  && <MyChannelsTab />}
      {activeTab === "activity"  && <LiveActivityTab />}
      {activeTab === "guides"    && <GuidesTab />}
    </div>
  );
}
