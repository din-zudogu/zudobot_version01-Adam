"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineStatus {
  enabled: boolean; hasChannelSecret: boolean; hasChannelToken: boolean;
  channelSecretMask: string | null; channelTokenMask: string | null;
  liffId: string; webhookUrl: string;
}
interface MetaStatus {
  enabled: boolean; hasAppSecret: boolean; hasPageAccessToken: boolean;
  appSecretMask: string | null; pageAccessTokenMask: string | null;
  pageId: string; verifyToken: string; webhookUrl: string;
}
interface TikTokStatus {
  enabled: boolean; hasAccessToken: boolean; hasWebhookSecret: boolean;
  accessTokenMask: string | null; webhookSecretMask: string | null; webhookUrl: string;
}
interface ChannelsData {
  allowedDomain: string; line: LineStatus; meta: MetaStatus; tiktok: TikTokStatus;
}
interface MetaPage { id: string; name: string; token: string }

// ── Micro components ──────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="text-xs px-2.5 py-1 rounded-md border border-border-default bg-white hover:bg-surface-secondary transition-colors font-medium shrink-0"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function WebhookRow({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-border-default rounded-lg px-3 py-2">
      <code className="text-xs text-text-muted flex-1 break-all select-all">{url}</code>
      <CopyBtn text={url} />
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
      ${ok ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
      {label}
    </span>
  );
}

function FieldInput({
  label, value, onChange, placeholder, type = "text", hint, readonly,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; readonly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-text-secondary">{label}</label>
      <input
        type={type} value={value} readOnly={readonly}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 text-sm border border-border-default rounded-xl
          focus:outline-none focus:ring-2 focus:ring-brand-500
          ${readonly ? "bg-slate-50 cursor-default" : "bg-white"}`}
      />
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// ── Step guide component ──────────────────────────────────────────────────────

function StepGuide({ steps }: { steps: { icon: string; title: string; body: React.ReactNode }[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 group">
          {/* connector line */}
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-px flex-1 bg-border-default mt-1 mb-1" />}
          </div>
          <div className={`pb-5 ${i < steps.length - 1 ? "" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{step.icon}</span>
              <p className="text-sm font-semibold text-text-primary">{step.title}</p>
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">{step.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PLATFORM GUIDES (Thai) ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function LineGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <StepGuide steps={[
      {
        icon: "🌐", title: "เปิด LINE Developers Console",
        body: (
          <p>ไปที่ <strong>developers.line.biz</strong> แล้ว Sign in ด้วย LINE Account ของคุณ
            (ใช้ account เดียวกับ LINE Official Account ของธุรกิจ)</p>
        ),
      },
      {
        icon: "📱", title: "สร้างหรือเลือก Provider และ Channel",
        body: (
          <div className="space-y-1">
            <p>กด <strong>Create a new provider</strong> (หรือเลือก provider ที่มีอยู่)</p>
            <p>กด <strong>Create a new channel</strong> → เลือก <strong>Messaging API</strong></p>
            <p>กรอก Channel name, description, industry แล้วกด Create</p>
          </div>
        ),
      },
      {
        icon: "🔑", title: "คัดลอก Channel Secret",
        body: (
          <div className="space-y-1">
            <p>ในหน้า channel → แท็บ <strong>Basic settings</strong></p>
            <p>เลื่อนลงหา <strong>Channel secret</strong> → กด <strong>Copy</strong></p>
            <p className="text-amber-700 font-medium">⚠️ อย่าแชร์ค่านี้กับใคร</p>
          </div>
        ),
      },
      {
        icon: "🎫", title: "สร้าง Channel Access Token",
        body: (
          <div className="space-y-1">
            <p>ไปที่แท็บ <strong>Messaging API</strong></p>
            <p>เลื่อนลงหา <strong>Channel access token (long-lived)</strong></p>
            <p>กด <strong>Issue</strong> → คัดลอก token ที่ได้</p>
          </div>
        ),
      },
      {
        icon: "🔗", title: "ตั้งค่า Webhook URL",
        body: (
          <div className="space-y-2">
            <p>ในแท็บ Messaging API → หา <strong>Webhook URL</strong></p>
            <p>วาง URL ด้านล่างนี้:</p>
            <WebhookRow url={webhookUrl} />
            <p>กด <strong>Verify</strong> แล้ว toggle เปิด <strong>Use webhook</strong></p>
            <p className="text-amber-700">⚠️ ปิด &quot;Auto-reply messages&quot; และ &quot;Greeting messages&quot; ใน LINE Official Account Manager</p>
          </div>
        ),
      },
      {
        icon: "✨", title: "(แนะนำ) สร้าง LIFF App เพื่อประสบการณ์ที่ดีที่สุด",
        body: (
          <div className="space-y-1">
            <p>LIFF ทำให้ลูกค้าเปิดเว็บของคุณ <strong>ภายใน LINE app</strong> ได้โดยตรง (seamless กว่า)</p>
            <p>ใน LINE Developers → เลือก Provider → แท็บ <strong>LIFF</strong></p>
            <p>กด <strong>Add</strong> → ตั้ง Endpoint URL เป็น URL เว็บไซต์ของคุณ → Size: <strong>Full</strong></p>
            <p>คัดลอก <strong>LIFF ID</strong> (หน้าตาเช่น <code className="bg-white px-1 rounded border">1234567890-xxxxxxxx</code>) ใส่ในช่อง LIFF ID ด้านบน</p>
          </div>
        ),
      },
    ]} />
  );
}

function MetaGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <StepGuide steps={[
      {
        icon: "🌐", title: "เปิด Meta for Developers",
        body: (
          <p>ไปที่ <strong>developers.facebook.com</strong> → <strong>My Apps</strong> → <strong>Create App</strong>
            → เลือกประเภท <strong>Business</strong></p>
        ),
      },
      {
        icon: "💬", title: "เพิ่ม Messenger Product",
        body: (
          <p>ใน Dashboard ของ App → <strong>Add Product</strong> → เลือก <strong>Messenger</strong> → กด Set up</p>
        ),
      },
      {
        icon: "🔗", title: "ตั้งค่า Webhook",
        body: (
          <div className="space-y-2">
            <p>ใน Messenger settings → <strong>Webhooks</strong> → <strong>Add Callback URL</strong></p>
            <p>วาง Webhook URL:</p>
            <WebhookRow url={webhookUrl} />
            <p>ใส่ <strong>Verify Token</strong> ตามที่แสดงใน Zudobot (ช่อง Verify Token ด้านบน)</p>
            <p>กด Verify แล้ว Subscribe ✔ <strong>messages</strong></p>
          </div>
        ),
      },
      {
        icon: "🔑", title: "Generate Page Access Token",
        body: (
          <div className="space-y-1">
            <p>ใน Messenger settings → <strong>Access Tokens</strong></p>
            <p>เลือก Facebook Page ของคุณ → กด <strong>Generate token</strong></p>
            <p>คัดลอก token ใส่ในช่อง Page Access Token ด้านบน</p>
          </div>
        ),
      },
      {
        icon: "🔒", title: "คัดลอก App Secret",
        body: (
          <div className="space-y-1">
            <p>App Dashboard → <strong>Settings → Basic</strong></p>
            <p>กด <strong>Show</strong> ข้าง App secret → คัดลอก</p>
          </div>
        ),
      },
      {
        icon: "📸", title: "(สำหรับ Instagram) เชื่อม Instagram Business",
        body: (
          <div className="space-y-1">
            <p>Instagram account ต้องเป็นประเภท <strong>Business หรือ Creator</strong> และเชื่อมกับ Facebook Page</p>
            <p>ใน Messenger settings → <strong>Instagram</strong> → Connect account</p>
            <p>Subscribe ✔ <strong>instagram_messages</strong> ใน Webhooks</p>
          </div>
        ),
      },
    ]} />
  );
}

function TikTokGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <StepGuide steps={[
      {
        icon: "🌐", title: "สมัครใช้ TikTok for Developers",
        body: (
          <p>ไปที่ <strong>developers.tiktok.com</strong> → <strong>Manage apps</strong> → <strong>Connect an app</strong>
            หรือสร้าง App ใหม่</p>
        ),
      },
      {
        icon: "✉️", title: "เพิ่ม Direct Message Permission",
        body: (
          <div className="space-y-1">
            <p>ใน App settings → <strong>Products</strong></p>
            <p>เพิ่ม <strong>Direct Message API</strong> → Request access</p>
            <p className="text-amber-700">⚠️ TikTok DM API ต้องผ่านการ review ก่อนใช้งาน production (ใช้ sandbox ระหว่างรอ)</p>
          </div>
        ),
      },
      {
        icon: "🔗", title: "ตั้งค่า Webhook Endpoint",
        body: (
          <div className="space-y-2">
            <p>ใน App settings → <strong>Webhooks</strong> → <strong>Add endpoint</strong></p>
            <p>วาง Webhook URL:</p>
            <WebhookRow url={webhookUrl} />
            <p>เลือก Event <strong>direct_message.received</strong></p>
          </div>
        ),
      },
      {
        icon: "🔑", title: "คัดลอก Access Token และ Webhook Secret",
        body: (
          <div className="space-y-1">
            <p><strong>Access Token:</strong> App settings → <strong>Basic information</strong> → Access token</p>
            <p><strong>Webhook Secret:</strong> App settings → Webhooks → กด Show secret → คัดลอก</p>
          </div>
        ),
      },
    ]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PLATFORM CARDS ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function PlatformCard({
  icon, title, accentColor, connected, enabled, renderContent,
}: {
  icon: string; title: string; accentColor: string;
  connected: boolean; enabled: boolean;
  renderContent: (tab: "setup" | "guide") => React.ReactNode;
}) {
  const [tab, setTab] = useState<"setup"|"guide">("setup");

  return (
    <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-border-default flex items-center gap-3 ${accentColor}`}>
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="font-bold text-base">{title}</p>
        </div>
        <StatusBadge
          ok={connected && enabled}
          label={connected && enabled ? "เชื่อมต่อแล้ว" : connected ? "ยังไม่เปิดใช้งาน" : "ยังไม่ได้เชื่อมต่อ"}
        />
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border-default">
        {(["setup", "guide"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === t
                ? "text-brand-700 border-b-2 border-brand-600 bg-brand-50"
                : "text-text-muted hover:text-text-primary"}`}
          >
            {t === "setup" ? "⚙️ ตั้งค่า" : "📖 คู่มือ"}
          </button>
        ))}
      </div>

      <div className="px-6 py-5">
        {renderContent(tab)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── LINE SECTION ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function LineSection({
  data, onSave, onDisconnect, onToggle, saving,
}: {
  data: ChannelsData;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDisconnect: (platform: string) => Promise<void>;
  onToggle: (field: string, current: boolean) => Promise<void>;
  saving: boolean;
}) {
  const [secret, setSecret] = useState("");
  const [token,  setToken]  = useState("");
  const [liffId, setLiffId] = useState(data.line.liffId ?? "");
  const line = data.line;

  return (
    <PlatformCard
      icon="💬" title="LINE Official Account"
      accentColor="bg-green-50 text-green-800"
      connected={line.hasChannelSecret && line.hasChannelToken}
      enabled={line.enabled}
      renderContent={(tab) => tab === "guide"
        ? <LineGuide webhookUrl={line.webhookUrl} />
        : (
          <div className="space-y-5">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary">
                📎 Webhook URL — วางใน LINE Developer Console
              </p>
              <WebhookRow url={line.webhookUrl} />
              <p className="text-xs text-text-muted">
                LINE Developers → Messaging API → Webhook settings → Use webhook: ON
              </p>
            </div>

            {/* Credential status */}
            {(line.hasChannelSecret || line.hasChannelToken) && (
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={line.hasChannelSecret} label={line.hasChannelSecret ? `Secret: ${line.channelSecretMask}` : "Channel Secret ยังไม่ได้ตั้งค่า"} />
                <StatusBadge ok={line.hasChannelToken}  label={line.hasChannelToken  ? `Token: ${line.channelTokenMask}` : "Access Token ยังไม่ได้ตั้งค่า"} />
              </div>
            )}

            {/* Inputs */}
            <FieldInput
              label="Channel Secret"
              value={secret} onChange={setSecret}
              placeholder={line.channelSecretMask ?? "วาง Channel Secret ที่นี่"}
              type="password"
              hint="LINE Developer Console → Basic settings → Channel secret"
            />
            <FieldInput
              label="Channel Access Token (Long-lived)"
              value={token} onChange={setToken}
              placeholder={line.channelTokenMask ?? "วาง Channel Access Token ที่นี่"}
              type="password"
              hint="LINE Developer Console → Messaging API → Issue token"
            />
            <FieldInput
              label="LIFF ID (ไม่บังคับ แต่แนะนำอย่างยิ่ง)"
              value={liffId} onChange={setLiffId}
              placeholder="1234567890-xxxxxxxx"
              hint="ทำให้ลูกค้าเปิดเว็บของคุณภายใน LINE app ได้เลย (seamless กว่า external browser)"
            />

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                disabled={(!secret && !token && liffId === (data.line.liffId ?? "")) || saving}
                onClick={() => onSave({
                  ...(secret ? { lineChannelSecret: secret } : {}),
                  ...(token  ? { lineChannelToken: token }   : {}),
                  lineLiffId: liffId,
                  ...((secret || token) ? { lineOmniEnabled: true } : {}),
                })}
                className="px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>

              {(line.hasChannelSecret || line.hasChannelToken) && (
                <>
                  <button
                    onClick={() => onToggle("lineOmniEnabled", line.enabled)}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors
                      ${line.enabled
                        ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                        : "border border-green-500 text-green-700 hover:bg-green-50"}`}
                  >
                    {line.enabled ? "✓ เปิดใช้งานอยู่" : "เปิดใช้งาน"}
                  </button>
                  <button onClick={() => onDisconnect("line")}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto">
                    ยกเลิกการเชื่อมต่อ
                  </button>
                </>
              )}
            </div>
          </div>
        )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── META SECTION (Facebook + Instagram) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function MetaSection({
  data, onSave, onDisconnect, onToggle, saving,
  pendingPages, onPagePick,
}: {
  data: ChannelsData;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDisconnect: (platform: string) => Promise<void>;
  onToggle: (field: string, current: boolean) => Promise<void>;
  saving: boolean;
  pendingPages:  MetaPage[] | null;
  onPagePick:    (page: MetaPage) => Promise<void>;
}) {
  const [appSecret,   setAppSecret]   = useState("");
  const [pageToken,   setPageToken]   = useState("");
  const [pageId,      setPageId]      = useState(data.meta.pageId ?? "");
  const [verifyToken, setVerifyToken] = useState(data.meta.verifyToken ?? "");
  const [showManual,  setShowManual]  = useState(false);
  const meta = data.meta;

  // Auto-generate verify token if empty
  useEffect(() => {
    if (!verifyToken && !meta.verifyToken) {
      const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      setVerifyToken(rand);
    }
  }, [meta.verifyToken, verifyToken]);

  const isConnected = meta.hasPageAccessToken;

  return (
    <PlatformCard
      icon="📘" title="Facebook Messenger + Instagram"
      accentColor="bg-blue-50 text-blue-800"
      connected={isConnected}
      enabled={meta.enabled}
      renderContent={(tab) => tab === "guide"
        ? <MetaGuide webhookUrl={meta.webhookUrl} />
        : (
          <div className="space-y-5">
            {/* Multi-page picker */}
            {pendingPages && pendingPages.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800">เลือก Facebook Page ที่ต้องการเชื่อมต่อ</p>
                <div className="space-y-2">
                  {pendingPages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => onPagePick(page)}
                      className="w-full text-left px-4 py-2.5 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 transition-colors text-sm font-medium text-blue-900"
                    >
                      📄 {page.name} <span className="text-xs text-text-muted ml-1">({page.id})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Connected status */}
            {isConnected && !pendingPages && (
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={true}               label={`Page ID: ${meta.pageId || "—"}`} />
                <StatusBadge ok={meta.hasPageAccessToken} label={meta.hasPageAccessToken ? `Token: ${meta.pageAccessTokenMask}` : "ยังไม่ได้ตั้งค่า"} />
              </div>
            )}

            {/* OAuth Quick Connect button */}
            {!isConnected && !pendingPages && (
              <div className="space-y-3">
                <a
                  href="/api/tenant/channels/meta-oauth?action=start"
                  className="flex items-center justify-center gap-2.5 w-full py-3 px-4 bg-[#1877F2] text-white rounded-xl font-semibold text-sm hover:bg-[#166FE5] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  เชื่อมต่อด้วย Facebook (แนะนำ — 1 คลิก)
                </a>
                <p className="text-xs text-text-muted text-center">
                  Zudobot จะขอสิทธิ์เข้าถึง Facebook Page ของคุณเพื่อรับ-ส่งข้อความเท่านั้น
                </p>
                <button
                  onClick={() => setShowManual(!showManual)}
                  className="text-xs text-text-muted hover:text-brand-600 underline w-full text-center transition-colors"
                >
                  {showManual ? "ซ่อนการตั้งค่าแบบ manual" : "ตั้งค่าด้วยตนเอง (advanced)"}
                </button>
              </div>
            )}

            {/* Manual setup (shown if connected or if user clicked manual) */}
            {(isConnected || showManual) && (
              <div className="space-y-4 border border-border-default rounded-xl p-4 bg-slate-50">
                <p className="text-xs font-semibold text-text-secondary">⚙️ ตั้งค่าแบบ Manual</p>

                {/* Webhook URL */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-text-secondary">
                    📎 Webhook URL — วางใน Meta Developer Console
                  </p>
                  <WebhookRow url={meta.webhookUrl} />
                </div>

                {/* Verify token */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text-secondary">
                    Verify Token <span className="text-text-muted font-normal">(auto-generated)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={verifyToken} onChange={e => setVerifyToken(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-border-default rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                      placeholder="my-verify-token"
                    />
                    <CopyBtn text={verifyToken} />
                  </div>
                  <p className="text-xs text-text-muted">คัดลอกไปใส่ใน Meta Developer Console → Webhooks → Verify Token</p>
                </div>

                <FieldInput
                  label="App Secret"
                  value={appSecret} onChange={setAppSecret}
                  placeholder={meta.appSecretMask ?? "ใส่ App Secret จาก Meta Developer"}
                  type="password"
                  hint="Meta Developer → Settings → Basic → App secret"
                />
                <FieldInput
                  label="Page Access Token"
                  value={pageToken} onChange={setPageToken}
                  placeholder={meta.pageAccessTokenMask ?? "ใส่ Page Access Token"}
                  type="password"
                  hint="Meta Developer → Messenger → Access Tokens → Generate token"
                />
                <FieldInput
                  label="Page ID"
                  value={pageId} onChange={setPageId}
                  placeholder={meta.pageId || "123456789012345"}
                  hint="Facebook Page → About → Page ID"
                />

                <button
                  disabled={(!appSecret && !pageToken && !pageId && verifyToken === (data.meta.verifyToken ?? "")) || saving}
                  onClick={() => onSave({
                    ...(appSecret  ? { metaAppSecret: appSecret }           : {}),
                    ...(pageToken  ? { metaPageAccessToken: pageToken }     : {}),
                    ...(pageId     ? { metaPageId: pageId }                 : {}),
                    metaVerifyToken: verifyToken,
                  })}
                  className="w-full py-2 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า Manual"}
                </button>
              </div>
            )}

            {/* Actions for connected */}
            {isConnected && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onToggle("metaEnabled", meta.enabled)}
                  className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors
                    ${meta.enabled
                      ? "bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-700"
                      : "border border-blue-500 text-blue-700 hover:bg-blue-50"}`}
                >
                  {meta.enabled ? "✓ เปิดใช้งานอยู่" : "เปิดใช้งาน"}
                </button>
                <button onClick={() => onDisconnect("facebook")}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto">
                  ยกเลิกการเชื่อมต่อ
                </button>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
              Instagram ใช้ credentials ชุดเดียวกับ Facebook — เชื่อม Instagram Business Account กับ Facebook Page
              แล้วเปิด Instagram Messaging ใน Meta Developer Console
            </div>
          </div>
        )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TIKTOK SECTION ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function TikTokSection({
  data, onSave, onDisconnect, onToggle, saving,
}: {
  data: ChannelsData;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDisconnect: (platform: string) => Promise<void>;
  onToggle: (field: string, current: boolean) => Promise<void>;
  saving: boolean;
}) {
  const [accessToken,    setAccessToken]    = useState("");
  const [webhookSecret,  setWebhookSecret]  = useState("");
  const tt = data.tiktok;

  return (
    <PlatformCard
      icon="🎵" title="TikTok"
      accentColor="bg-slate-50 text-slate-800"
      connected={tt.hasAccessToken && tt.hasWebhookSecret}
      enabled={tt.enabled}
      renderContent={(tab) => tab === "guide"
        ? <TikTokGuide webhookUrl={tt.webhookUrl} />
        : (
          <div className="space-y-5">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary">
                📎 Webhook URL — วางใน TikTok Developer Console
              </p>
              <WebhookRow url={tt.webhookUrl} />
              <p className="text-xs text-text-muted">
                TikTok for Developers → App → Webhooks → Add endpoint URL
              </p>
            </div>

            {/* Status */}
            {(tt.hasAccessToken || tt.hasWebhookSecret) && (
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={tt.hasAccessToken}   label={tt.hasAccessToken   ? `Token: ${tt.accessTokenMask}`    : "Access Token ยังไม่ได้ตั้งค่า"} />
                <StatusBadge ok={tt.hasWebhookSecret} label={tt.hasWebhookSecret ? `Secret: ${tt.webhookSecretMask}` : "Webhook Secret ยังไม่ได้ตั้งค่า"} />
              </div>
            )}

            {/* TikTok DM API note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              ℹ️ TikTok Direct Message API ต้องยื่นขอสิทธิ์ก่อน — ใช้เวลา review ประมาณ 1-2 สัปดาห์
              ระหว่างนี้สามารถทดสอบด้วย Sandbox mode ได้
            </div>

            <FieldInput
              label="Access Token"
              value={accessToken} onChange={setAccessToken}
              placeholder={tt.accessTokenMask ?? "ใส่ Access Token จาก TikTok Developer"}
              type="password"
              hint="TikTok Developer Console → App → Basic information → Access token"
            />
            <FieldInput
              label="Webhook Secret"
              value={webhookSecret} onChange={setWebhookSecret}
              placeholder={tt.webhookSecretMask ?? "ใส่ Webhook Secret"}
              type="password"
              hint="TikTok Developer Console → App → Webhooks → Show secret"
            />

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                disabled={(!accessToken && !webhookSecret) || saving}
                onClick={() => onSave({
                  ...(accessToken   ? { tiktokAccessToken: accessToken }     : {}),
                  ...(webhookSecret ? { tiktokWebhookSecret: webhookSecret } : {}),
                })}
                className="px-5 py-2 text-sm font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-40 transition-colors"
              >
                {saving ? "กำลังบันทึก…" : "บันทึก TikTok"}
              </button>

              {(tt.hasAccessToken || tt.hasWebhookSecret) && (
                <>
                  <button
                    onClick={() => onToggle("tiktokEnabled", tt.enabled)}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors
                      ${tt.enabled
                        ? "bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-700"
                        : "border border-slate-500 text-slate-700 hover:bg-slate-50"}`}
                  >
                    {tt.enabled ? "✓ เปิดใช้งานอยู่" : "เปิดใช้งาน"}
                  </button>
                  <button onClick={() => onDisconnect("tiktok")}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto">
                    ยกเลิกการเชื่อมต่อ
                  </button>
                </>
              )}
            </div>
          </div>
        )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function ChannelsPageInner() {
  const searchParams    = useSearchParams();
  const [data,    setData]    = useState<ChannelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  // Meta OAuth state (from URL params after callback)
  const [pendingPages,  setPendingPages]  = useState<MetaPage[] | null>(null);
  const [pendingVerify, setPendingVerify] = useState("");
  const [pendingState,  setPendingState]  = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/tenant/channels", { cache: "no-store" });
      const json = await res.json() as ChannelsData;
      setData(json);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Handle OAuth callback URL params
  useEffect(() => {
    const metaSuccess = searchParams.get("meta_success");
    const metaPage    = searchParams.get("meta_page");
    const metaError   = searchParams.get("meta_error");
    const metaPending = searchParams.get("meta_pending");
    const metaVerify  = searchParams.get("meta_verify");
    const metaState   = searchParams.get("meta_state");

    if (metaSuccess === "connected") {
      showToast(`✓ เชื่อมต่อ Facebook Page "${metaPage}" สำเร็จ`, true);
      void load();
    } else if (metaError) {
      if (metaError === "cancelled")          showToast("ยกเลิกการเชื่อมต่อ Facebook", false);
      else if (metaError === "no_pages")      showToast("ไม่พบ Facebook Page ที่มีสิทธิ์จัดการ", false);
      else if (metaError === "app_not_configured") showToast("Facebook App ยังไม่ได้ตั้งค่าบน server", false);
      else                                    showToast(`เชื่อมต่อ Facebook ล้มเหลว: ${metaError}`, false);
    } else if (metaPending && metaVerify && metaState) {
      try {
        // base64url → standard base64 → JSON (browser-safe, no Buffer needed)
        const b64 = metaPending.replace(/-/g, "+").replace(/_/g, "/");
        const pages = JSON.parse(atob(b64)) as MetaPage[];
        setPendingPages(pages);
        setPendingVerify(metaVerify);
        setPendingState(metaState);
      } catch { /* ignore */ }
    }
  }, [searchParams, load]);

  async function doSave(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showToast("บันทึกสำเร็จ", true);
      await load();
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", false);
    } finally { setSaving(false); }
  }

  async function doDisconnect(platform: string) {
    if (!confirm(`ยืนยันการยกเลิกการเชื่อมต่อ ${platform}?`)) return;
    setSaving(true);
    try {
      await fetch("/api/tenant/channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      showToast("ยกเลิกการเชื่อมต่อสำเร็จ", true);
      if (platform === "facebook") setPendingPages(null);
      await load();
    } catch { showToast("เกิดข้อผิดพลาด", false); }
    finally { setSaving(false); }
  }

  async function doToggle(field: string, current: boolean) {
    await doSave({ [field]: !current });
  }

  async function onPagePick(page: MetaPage) {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/channels/meta-oauth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId:      page.id,
          pageName:    page.name,
          pageToken:   page.token,
          verifyToken: pendingVerify,
          state:       pendingState,
        }),
      });
      if (!res.ok) throw new Error();
      setPendingPages(null);
      showToast(`✓ เชื่อมต่อ Facebook Page "${page.name}" สำเร็จ`, true);
      await load();
    } catch { showToast("เลือก Page ไม่สำเร็จ", false); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!data) return <p className="text-text-muted">ไม่สามารถโหลดข้อมูลได้</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl
          ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">📡 ช่องทางสนทนา</h1>
        <p className="text-sm text-text-muted mt-1">
          เชื่อมต่อ LINE / Facebook / Instagram / TikTok → ลูกค้าคลิกลิงก์ → คุยต่อกับ Zudobot บนเว็บไซต์ของคุณ
        </p>
      </div>

      {/* Domain warning */}
      {!data.allowedDomain && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-900 flex gap-2">
          <span>⚠️</span>
          <p>กรุณาตั้งค่า <strong>Domain</strong> ใน <a href="/dashboard/widget" className="underline">Widget Embed</a> ก่อน
            — Zudobot ใช้ domain นี้สร้าง deep link ส่งให้ลูกค้า</p>
        </div>
      )}

      {/* How it works banner */}
      <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 rounded-2xl px-5 py-4">
        <p className="text-sm font-bold text-brand-800 mb-2">💡 วิธีการทำงาน</p>
        <div className="flex flex-wrap gap-2 text-xs text-brand-700">
          {["ลูกค้าพิมพ์บน LINE/FB/IG/TikTok", "→", "Zudobot รับข้อความ", "→", "ส่ง deep link กลับ", "→", "ลูกค้าคลิก → เปิดเว็บ → Zudobot widget เปิดอัตโนมัติ"].map((t, i) => (
            t === "→"
              ? <span key={i} className="text-brand-400 font-bold">{t}</span>
              : <span key={i} className="bg-white border border-brand-200 px-2 py-0.5 rounded-lg">{t}</span>
          ))}
        </div>
      </div>

      {/* Platform cards */}
      <LineSection
        data={data} onSave={doSave} onDisconnect={doDisconnect} onToggle={doToggle} saving={saving}
      />

      <MetaSection
        data={data} onSave={doSave} onDisconnect={doDisconnect} onToggle={doToggle} saving={saving}
        pendingPages={pendingPages}
        onPagePick={onPagePick}
      />

      <TikTokSection
        data={data} onSave={doSave} onDisconnect={doDisconnect} onToggle={doToggle} saving={saving}
      />
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChannelsPageInner />
    </Suspense>
  );
}
