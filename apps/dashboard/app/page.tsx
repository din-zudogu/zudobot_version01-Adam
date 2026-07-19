"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ───────────────────────────────────────────────────── */
type DaySchedule = { day: number; open: string; close: string };

type BotConfig = {
  botName: string;
  botAvatar: string;
  backstory: string;
  botIntro: string;
  toneOfVoice: "FRIENDLY" | "PROFESSIONAL" | "PLAYFUL";
  primaryLanguage: "th" | "en" | "both";
  customKnowledge: string;
  shippingPolicy: string;
  returnPolicy: string;
  maxDiscountPercent: number;
  forbiddenTopics: string[];
  handoffMessage: string;
  themeColor: string;
  operatingHours: {
    enabled: boolean;
    timezone: string;
    schedule: DaySchedule[];
    offlineMessage: string;
  };
};

type KBArticle = {
  _id: string;
  title: string;
  content: string;
  type: "text" | "url" | "pdf";
  sourceUrl: string | null;
  isActive: boolean;
  updatedAt: string;
};

type Toast = { msg: string; type: "success" | "error"; id: number };

type HeaderUsage = {
  activePackageSlug:   string | null;
  usedMessages:        number;
  totalMessageQuota:   number;
  messageUsagePercent: number;
  isInGracePeriod:     boolean;
  isMemoryFull:        boolean;
  daysUntilReset:      number;
};

/* ── Helpers ─────────────────────────────────────────────────── */
const DEFAULT_CONFIG: BotConfig = {
  botName: "Zudobot",
  botAvatar: "🤖",
  backstory: "",
  botIntro: "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ? 😊",
  toneOfVoice: "FRIENDLY",
  primaryLanguage: "th",
  customKnowledge: "",
  shippingPolicy: "",
  returnPolicy: "",
  maxDiscountPercent: 10,
  forbiddenTopics: [],
  handoffMessage: "ได้แจ้งทีมงานให้ติดต่อกลับโดยเร็วที่สุดเลยนะคะ 🙏",
  themeColor: "#9333ea",
  operatingHours: {
    enabled: false,
    timezone: "Asia/Bangkok",
    schedule: [],
    offlineMessage: "ขณะนี้ร้านปิดให้บริการแล้วค่ะ เปิดทำการวันพรุ่งนี้นะคะ 🙏",
  },
};

const EMPTY_ARTICLE: { title: string; content: string; type: "text" | "url" | "pdf"; sourceUrl: string; isActive: boolean } =
  { title: "", content: "", type: "text", sourceUrl: "", isActive: true };

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

/* ── Toast component ─────────────────────────────────────────── */
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

/* ── Header Usage Meter ──────────────────────────────────────── */
function HeaderUsageMeter({
  usage,
  onClickUsage,
}: {
  usage: HeaderUsage;
  onClickUsage: () => void;
}) {
  const pct   = Math.min(100, usage.messageUsagePercent);
  const color = usage.isInGracePeriod || pct >= 90
    ? "#ef4444"
    : pct >= 70
    ? "#f97316"
    : "#22c55e";

  return (
    <button
      onClick={onClickUsage}
      title={`Messages: ${usage.usedMessages} / ${usage.totalMessageQuota} — click to view Usage & Plans`}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--bg-alt)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "5px 12px", cursor: "pointer",
        fontSize: 12, color: "var(--fg)",
      }}
    >
      {usage.isInGracePeriod && (
        <span title="Grace period active" style={{ fontSize: 14 }}>⚠️</span>
      )}
      {usage.isMemoryFull && (
        <span title="Customer memory full" style={{ fontSize: 14 }}>🧠</span>
      )}
      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>Messages</span>
      <div style={{ width: 64, height: 5, background: "var(--slate-200)", borderRadius: 3, flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontWeight: 700, color, whiteSpace: "nowrap" }}>{pct}%</span>
      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
        {usage.daysUntilReset}d left
      </span>
    </button>
  );
}

/* ── Onboarding Banner ───────────────────────────────────────── */
function OnboardingBanner({
  apiFetch,
  onDone,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  onDone: () => void;
}) {
  const [step, setStep]       = useState<"idle" | "seeding" | "activating" | "done">("idle");
  const [error, setError]     = useState("");

  async function activate() {
    setError("");
    setStep("seeding");
    // 1. Ensure default packages exist
    const seedRes = await apiFetch("/api/v1/admin/packages/seed", { method: "POST" });
    if (!seedRes.ok) { setStep("idle"); setError(seedRes.error ?? "Seed failed"); return; }

    // 2. Activate free trial
    setStep("activating");
    const trialRes = await apiFetch("/api/v1/admin/packages/purchase", {
      method: "POST",
      body: JSON.stringify({ packageSlug: "trial", amount: 0, note: "Auto-activated on first login" }),
    });
    if (!trialRes.ok) { setStep("idle"); setError(trialRes.error ?? "Activation failed"); return; }

    setStep("done");
    setTimeout(onDone, 800);
  }

  if (step === "done") {
    return (
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <strong style={{ color: "#15803d" }}>Trial activated! Redirecting to Usage & Plans…</strong>
      </div>
    );
  }

  const busy = step === "seeding" || step === "activating";

  return (
    <div style={{
      background: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)",
      border: "1.5px solid #c4b5fd", borderRadius: 12,
      padding: "20px 24px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <span style={{ fontSize: 36, lineHeight: 1 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--purple)", marginBottom: 6 }}>
            ยินดีต้อนรับสู่ Zudobot!
          </div>
          <div style={{ fontSize: 13, color: "var(--fg)", marginBottom: 16, lineHeight: 1.6 }}>
            กด <strong>Activate Free Trial</strong> เพื่อเปิดใช้งานโควต้า 100 ข้อความฟรี
            ระบบจะเตรียม packages และเปิดใช้งาน Trial Plan ให้โดยอัตโนมัติ
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
            {[
              { icon: "💬", label: "100 ข้อความฟรี", done: false },
              { icon: "📊", label: "Analytics & CRM", done: false },
              { icon: "🤖", label: "AI Sales Agent", done: false },
              { icon: "🧠", label: "Customer Memory (ต้องตั้ง Atlas Index)", done: false },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span>{icon}</span>
                <span style={{ color: "var(--fg)" }}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>⚠ {error}</div>
          )}

          <button className="btn btn-primary" onClick={activate} disabled={busy} style={{ minWidth: 200 }}>
            {busy ? (
              <><span className="spinner" /> {step === "seeding" ? "Preparing packages…" : "Activating trial…"}</>
            ) : (
              "🚀 Activate Free Trial"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */
export default function KMSPage() {
  const [secretKey, setSecretKey]   = useState("");
  const [apiUrl, setApiUrl]         = useState(getApiUrl());
  const [authed, setAuthed]         = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr, setAuthErr]       = useState("");

  const [tab, setTab]               = useState<"persona" | "products" | "knowledge" | "scope" | "commands" | "line" | "widget" | "rules" | "analytics" | "visitors" | "usage">("persona");
  const [toasts, setToasts]         = useState<Toast[]>([]);
  const [toastId, setToastId]       = useState(0);
  const [headerUsage, setHeaderUsage] = useState<HeaderUsage | null>(null);

  /* ── Persist auth across refresh ─────────────────────────── */
  useEffect(() => {
    const sk = sessionStorage.getItem("zb_secret_key");
    const au = sessionStorage.getItem("zb_api_url");
    if (sk && au) { setSecretKey(sk); setApiUrl(au); setAuthed(true); }
  }, []);

  /* ── Toast helper ─────────────────────────────────────────── */
  const showToast = useCallback((msg: string, type: "success" | "error") => {
    const id = toastId + 1;
    setToastId(id);
    setToasts((t) => [...t, { msg, type, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, [toastId]);

  /* ── API helper ───────────────────────────────────────────── */
  const apiFetch = useCallback(async (
    path: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    try {
      const res = await fetch(`${apiUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-secret-key": secretKey,
          ...(options.headers ?? {}),
        },
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
      return { ok: true, data: json };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, [apiUrl, secretKey]);

  /* ── Header usage — fetch once after auth, refresh every 2 min ── */
  const fetchHeaderUsage = useCallback(async () => {
    const res = await apiFetch("/api/v1/admin/usage");
    if (res.ok && res.data) {
      const d = (res.data as { data: Record<string, unknown> }).data;
      setHeaderUsage({
        activePackageSlug:   (d.activePackageSlug as string | null) ?? null,
        usedMessages:        (d.usedMessages        as number) ?? 0,
        totalMessageQuota:   (d.totalMessageQuota   as number) ?? 0,
        messageUsagePercent: (d.messageUsagePercent as number) ?? 0,
        isInGracePeriod:     Boolean(d.isInGracePeriod),
        isMemoryFull:        Boolean(d.isMemoryFull),
        daysUntilReset:      (d.daysUntilReset      as number) ?? 30,
      });
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!authed) return;
    fetchHeaderUsage();
    const interval = setInterval(fetchHeaderUsage, 120_000);
    return () => clearInterval(interval);
  }, [authed, fetchHeaderUsage]);

  /* ── Login ────────────────────────────────────────────────── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secretKey.trim()) return;
    setAuthLoading(true);
    setAuthErr("");
    const res = await apiFetch("/api/v1/admin/bot-config");
    setAuthLoading(false);
    if (res.ok) {
      sessionStorage.setItem("zb_secret_key", secretKey);
      sessionStorage.setItem("zb_api_url", apiUrl);
      setAuthed(true);
    } else {
      setAuthErr(res.error ?? "Authentication failed");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("zb_secret_key");
    sessionStorage.removeItem("zb_api_url");
    setAuthed(false);
    setSecretKey("");
  }

  /* ── Render ───────────────────────────────────────────────── */
  if (!authed) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">🤖 ZUDOBOT</div>
          <div className="auth-sub">Knowledge Management System</div>
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>API URL</label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:4000"
                required
              />
            </div>
            <div className="field">
              <label>Secret Key</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_xxxxxxxxxxxxxxxx"
                required
                autoFocus
              />
              <div className="hint">Use the x-secret-key from your tenant credentials.</div>
            </div>
            {authErr && (
              <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 14 }}>⚠ {authErr}</div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={authLoading}>
              {authLoading ? <span className="spinner" /> : "Sign In →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="logo">
          🤖 ZUDOBOT <span>KMS</span>
        </div>
        {headerUsage && (
          <HeaderUsageMeter usage={headerUsage} onClickUsage={() => setTab("usage")} />
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
      </header>

      <main className="app-main">
        {headerUsage && !headerUsage.activePackageSlug && (
          <OnboardingBanner
            apiFetch={apiFetch}
            onDone={() => { fetchHeaderUsage(); setTab("usage"); }}
          />
        )}
        <div className="tabs">
          {(["persona", "products", "knowledge", "scope", "commands", "line", "widget", "rules", "analytics", "visitors", "usage"] as const).map((t) => (
            <button
              key={t}
              className={`tab-btn${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "persona"   && "🎭 Persona"}
              {t === "products"  && "🛍️ Products"}
              {t === "knowledge" && "📚 Knowledge Base"}
              {t === "scope"     && "🔒 Scope & Rules"}
              {t === "commands"  && "📋 Custom Instructions"}
              {t === "line"      && "🔔 LINE Notify"}
              {t === "widget"    && "🧩 Widget Code"}
              {t === "rules"     && "🚨 Rules Log"}
              {t === "analytics" && "📊 Analytics"}
              {t === "visitors"  && "👥 Visitors"}
              {t === "usage"     && "💳 Usage & Plans"}
            </button>
          ))}
        </div>

        {tab === "persona"   && <PersonaTab            apiFetch={apiFetch} showToast={showToast} />}
        {tab === "products"  && <ProductsTab           apiFetch={apiFetch} showToast={showToast} />}
        {tab === "knowledge" && <KnowledgeTab          apiFetch={apiFetch} showToast={showToast} />}
        {tab === "scope"     && <ScopeTab              apiFetch={apiFetch} showToast={showToast} />}
        {tab === "commands"  && <CustomInstructionsTab apiFetch={apiFetch} showToast={showToast} />}
        {tab === "line"      && <LineNotifyTab         apiFetch={apiFetch} showToast={showToast} />}
        {tab === "widget"    && <WidgetCodeTab apiUrl={apiUrl} />}
        {tab === "rules"     && <RulesLogTab  apiFetch={apiFetch} />}
        {tab === "analytics" && <AnalyticsTab apiFetch={apiFetch} />}
        {tab === "visitors"  && <VisitorsTab  apiFetch={apiFetch} showToast={showToast} />}
        {tab === "usage"     && <UsageTab     apiFetch={apiFetch} showToast={showToast} />}
      </main>

      <Toasts toasts={toasts} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Persona Tab
   ═══════════════════════════════════════════════════════════════ */
function PersonaTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [config, setConfig]     = useState<BotConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    apiFetch("/api/v1/admin/bot-config").then((res) => {
      if (res.ok && res.data) setConfig((res.data as { data: BotConfig }).data ?? DEFAULT_CONFIG);
      setLoading(false);
    });
  }, [apiFetch]);

  function set(field: keyof BotConfig, value: unknown) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await apiFetch("/api/v1/admin/bot-config", {
      method: "PATCH",
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (res.ok) showToast("Persona saved ✓", "success");
    else showToast(res.error ?? "Save failed", "error");
  }

  if (loading) return <div className="loading-full"><span className="spinner" /> Loading…</div>;

  return (
    <div>
      <div className="card">
        <div className="section-title">Bot Identity</div>
        <div className="row">
          <div className="field">
            <label>Bot Name</label>
            <input value={config.botName} onChange={(e) => set("botName", e.target.value)} maxLength={100} />
          </div>
          <div className="field">
            <label>Theme Color</label>
            <div className="d-flex gap-2 align-center">
              <input type="color" value={config.themeColor} onChange={(e) => set("themeColor", e.target.value)} style={{ width: 44, height: 38, padding: 2, borderRadius: 8, border: "1.5px solid var(--slate-200)", cursor: "pointer" }} />
              <input value={config.themeColor} onChange={(e) => set("themeColor", e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
        <div className="field">
          <label>Intro Message</label>
          <textarea value={config.botIntro} onChange={(e) => set("botIntro", e.target.value)} maxLength={500} rows={2} />
          <div className="hint">First message shown when the chat opens.</div>
        </div>
        <div className="field">
          <label>Handoff Message</label>
          <input value={config.handoffMessage} onChange={(e) => set("handoffMessage", e.target.value)} maxLength={300} />
          <div className="hint">Sent when the AI hands off to a human agent.</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Tone & Language</div>
        <div className="row">
          <div className="field">
            <label>Tone of Voice</label>
            <select value={config.toneOfVoice} onChange={(e) => set("toneOfVoice", e.target.value as BotConfig["toneOfVoice"])}>
              <option value="FRIENDLY">😊 Friendly</option>
              <option value="PROFESSIONAL">💼 Professional</option>
              <option value="PLAYFUL">🎉 Playful</option>
            </select>
          </div>
          <div className="field">
            <label>Primary Language</label>
            <select value={config.primaryLanguage} onChange={(e) => set("primaryLanguage", e.target.value as BotConfig["primaryLanguage"])}>
              <option value="th">🇹🇭 Thai</option>
              <option value="en">🇬🇧 English</option>
              <option value="both">🌐 Both</option>
            </select>
          </div>
          <div className="field">
            <label>Max Discount %</label>
            <input type="number" min={0} max={100} value={config.maxDiscountPercent} onChange={(e) => set("maxDiscountPercent", Number(e.target.value))} />
            <div className="hint">Maximum discount the bot may offer. Set 0 to disallow.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">🎭 Bot Backstory</div>
        <div className="field mb-0">
          <label>Backstory / Persona</label>
          <textarea
            value={config.backstory}
            onChange={(e) => set("backstory", e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={`e.g. คุณคือ "น้องดาว" พนักงานขายที่เชี่ยวชาญด้านอุปกรณ์ดำน้ำ ทำงานกับ Dives Space มา 5 ปี มีความรักในการดำน้ำและชอบแนะนำสินค้าให้ตรงกับความต้องการของลูกค้า`}
          />
          <div className="hint">{config.backstory.length} / 1,000 chars — ใส่บุคลิก ประวัติ และความเชี่ยวชาญของ Bot เพื่อให้ตอบได้เป็นธรรมชาติขึ้น</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">🚚 Store Policies</div>
        <div className="field">
          <label>Shipping Policy</label>
          <textarea
            value={config.shippingPolicy}
            onChange={(e) => set("shippingPolicy", e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. จัดส่งฟรีเมื่อซื้อครบ ฿500 ใช้เวลา 1–3 วันทำการ ส่งด้วย Kerry / Flash Express"
          />
        </div>
        <div className="field mb-0">
          <label>Return Policy</label>
          <textarea
            value={config.returnPolicy}
            onChange={(e) => set("returnPolicy", e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. คืนสินค้าได้ภายใน 7 วัน สินค้าต้องอยู่ในสภาพเดิม พร้อมกล่อง"
          />
        </div>
      </div>

      <OperatingHoursCard config={config} set={set} />

      <div className="d-flex" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "Save Persona"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Operating Hours Card (used inside PersonaTab)
   ═══════════════════════════════════════════════════════════════ */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function OperatingHoursCard({
  config,
  set,
}: {
  config: BotConfig;
  set: (field: keyof BotConfig, value: unknown) => void;
}) {
  const oh = config.operatingHours;

  function setOh(key: keyof BotConfig["operatingHours"], value: unknown) {
    set("operatingHours", { ...oh, [key]: value });
  }

  function setScheduleDay(day: number, field: "open" | "close", value: string) {
    const existing = oh.schedule.find((s) => s.day === day);
    const updated  = existing
      ? oh.schedule.map((s) => s.day === day ? { ...s, [field]: value } : s)
      : [...oh.schedule, { day, open: "09:00", close: "21:00", [field]: value }];
    setOh("schedule", updated);
  }

  function toggleDay(day: number) {
    const exists = oh.schedule.some((s) => s.day === day);
    const updated = exists
      ? oh.schedule.filter((s) => s.day !== day)
      : [...oh.schedule, { day, open: "09:00", close: "21:00" }].sort((a, b) => a.day - b.day);
    setOh("schedule", updated);
  }

  function getDayEntry(day: number): DaySchedule | undefined {
    return oh.schedule.find((s) => s.day === day);
  }

  return (
    <div className="card">
      <div className="d-flex align-center justify-between" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>🕐 Operating Hours</div>
        <label className="d-flex align-center gap-2" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={oh.enabled}
            onChange={(e) => setOh("enabled", e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "var(--purple)" }}
          />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Enable</span>
        </label>
      </div>

      {oh.enabled && (
        <>
          <div className="field">
            <label>Timezone</label>
            <select value={oh.timezone} onChange={(e) => setOh("timezone", e.target.value)}>
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            {DAY_NAMES.map((name, day) => {
              const entry   = getDayEntry(day);
              const checked = Boolean(entry);
              return (
                <div key={day} className="d-flex align-center gap-2" style={{ marginBottom: 8 }}>
                  <label className="d-flex align-center gap-2" style={{ width: 56, cursor: "pointer", flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDay(day)}
                      style={{ accentColor: "var(--purple)" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? "var(--slate-800)" : "var(--slate-400)" }}>
                      {name}
                    </span>
                  </label>
                  {checked && entry ? (
                    <>
                      <input
                        type="time"
                        value={entry.open}
                        onChange={(e) => setScheduleDay(day, "open", e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--slate-200)", fontSize: 13 }}
                      />
                      <span style={{ color: "var(--slate-400)", fontSize: 12 }}>—</span>
                      <input
                        type="time"
                        value={entry.close}
                        onChange={(e) => setScheduleDay(day, "close", e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--slate-200)", fontSize: 13 }}
                      />
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--slate-400)" }}>ปิดวันนี้</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="field mb-0">
            <label>Offline Message</label>
            <textarea
              value={oh.offlineMessage}
              onChange={(e) => setOh("offlineMessage", e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="ข้อความที่แสดงเมื่อร้านปิด…"
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Knowledge Base Tab
   ═══════════════════════════════════════════════════════════════ */
function KnowledgeTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]     = useState(true);
  const [articles, setArticles]   = useState<KBArticle[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm]           = useState(EMPTY_ARTICLE);
  const [editId, setEditId]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/api/v1/admin/kb?includeInactive=${showInactive}`);
    if (res.ok && res.data) {
      setArticles(((res.data as { data: KBArticle[] }).data) ?? []);
    }
    setLoading(false);
  }, [apiFetch, showInactive]);

  useEffect(() => { load(); }, [load]);

  function startEdit(a: KBArticle) {
    setEditId(a._id);
    setForm({ title: a.title, content: a.content, type: a.type as "text" | "url" | "pdf", sourceUrl: a.sourceUrl ?? "", isActive: a.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditId(null); setForm(EMPTY_ARTICLE); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);

    const body = JSON.stringify({
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      sourceUrl: form.sourceUrl || null,
      isActive: form.isActive,
    });

    const res = editId
      ? await apiFetch(`/api/v1/admin/kb/${editId}`, { method: "PATCH", body })
      : await apiFetch("/api/v1/admin/kb", { method: "POST", body });

    setSubmitting(false);
    if (res.ok) {
      showToast(editId ? "Article updated ✓" : "Article created ✓", "success");
      cancelEdit();
      load();
    } else {
      showToast(res.error ?? "Failed", "error");
    }
  }

  async function deleteArticle(id: string) {
    setDeleteId(id);
    const res = await apiFetch(`/api/v1/admin/kb/${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) { showToast("Deleted ✓", "success"); load(); }
    else showToast(res.error ?? "Delete failed", "error");
  }

  async function toggleActive(a: KBArticle) {
    const res = await apiFetch(`/api/v1/admin/kb/${a._id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    if (res.ok) load();
    else showToast(res.error ?? "Failed", "error");
  }

  return (
    <div>
      {/* Add / Edit Form */}
      <div className="card">
        <div className="section-title">{editId ? "✏️ Edit Article" : "➕ Add Knowledge Article"}</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} placeholder="e.g. Dives Space Pricing FAQ" required />
          </div>
          <div className="field">
            <label>Content</label>
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={8} maxLength={20000} placeholder="Write the knowledge article here. The AI will use this to answer user questions." required />
            <div className="hint">{form.content.length} / 20,000 chars</div>
          </div>
          <div className="row">
            <div className="field mb-0">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}>
                <option value="text">📝 Text</option>
                <option value="url">🔗 URL Reference</option>
                <option value="pdf">📄 PDF Content</option>
              </select>
            </div>
            <div className="field mb-0">
              <label>Source URL (optional)</label>
              <input value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="field mb-0 d-flex align-center gap-2" style={{ paddingTop: 22 }}>
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--purple)" }} />
              <label htmlFor="isActive" style={{ cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500, marginBottom: 0 }}>Active</label>
            </div>
          </div>
          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : (editId ? "Update Article" : "Add Article")}
            </button>
            {editId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* Article List */}
      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>📋 Articles ({articles.length})</div>
          <label className="d-flex align-center gap-2 text-muted" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "var(--purple)" }} />
            Show inactive
          </label>
        </div>

        {loading ? (
          <div className="d-flex align-center gap-2 text-muted" style={{ padding: "20px 0" }}>
            <span className="spinner" /> Loading…
          </div>
        ) : articles.length === 0 ? (
          <div className="text-muted" style={{ padding: "20px 0", textAlign: "center" }}>
            No knowledge articles yet. Add one above to get started.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="kb-table">
              <thead>
                <tr>
                  <th>Title / Preview</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div className="title-cell">{a.title}</div>
                      <div className="content-preview">{a.content}</div>
                    </td>
                    <td><span className="badge badge-active" style={{ background: "#ede9fe", color: "var(--purple)" }}>{a.type}</span></td>
                    <td>
                      <button onClick={() => toggleActive(a)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <span className={`badge ${a.isActive ? "badge-active" : "badge-inactive"}`}>
                          {a.isActive ? "active" : "inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="text-muted">{new Date(a.updatedAt).toLocaleDateString()}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteArticle(a._id)} disabled={deleteId === a._id}>
                          {deleteId === a._id ? <span className="spinner" /> : "Delete"}
                        </button>
                      </div>
                    </td>
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

/* ═══════════════════════════════════════════════════════════════
   Scope & Rules Tab
   ═══════════════════════════════════════════════════════════════ */
function ScopeTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [forbidden, setForbidden] = useState<string[]>([]);
  const [customKnowledge, setCustomKnowledge] = useState("");
  const [newForbidden, setNewForbidden] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/admin/bot-config").then((res) => {
      if (res.ok && res.data) {
        const d = (res.data as { data: BotConfig }).data;
        setForbidden(d.forbiddenTopics ?? []);
        setCustomKnowledge(d.customKnowledge ?? "");
      }
      setLoading(false);
    });
  }, [apiFetch]);

  function addForbidden() {
    const val = newForbidden.trim();
    if (!val || forbidden.includes(val)) return;
    setForbidden((f) => [...f, val]);
    setNewForbidden("");
  }

  async function save() {
    setSaving(true);
    const res = await apiFetch("/api/v1/admin/bot-config", {
      method: "PATCH",
      body: JSON.stringify({ forbiddenTopics: forbidden, customKnowledge }),
    });
    setSaving(false);
    if (res.ok) showToast("Scope rules saved ✓", "success");
    else showToast(res.error ?? "Save failed", "error");
  }

  if (loading) return <div className="loading-full"><span className="spinner" /> Loading…</div>;

  return (
    <div>
      <div className="card">
        <div className="section-title">🚫 Forbidden Topics</div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          The AI will refuse to discuss these topics and redirect the conversation.
        </p>
        <div className="tag-list">
          {forbidden.map((topic) => (
            <span key={topic} className="tag">
              {topic}
              <button onClick={() => setForbidden((f) => f.filter((t) => t !== topic))} aria-label={`Remove ${topic}`}>×</button>
            </span>
          ))}
        </div>
        <div className="d-flex gap-2 mt-3">
          <input
            className="field"
            style={{ flex: 1, marginBottom: 0 }}
            value={newForbidden}
            onChange={(e) => setNewForbidden(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addForbidden(); } }}
            placeholder="e.g. competitor pricing, political topics…"
          />
          <button className="btn btn-ghost" onClick={addForbidden}>Add</button>
        </div>
        {forbidden.length === 0 && <div className="text-muted mt-2">No forbidden topics set — the bot will answer any question.</div>}
      </div>

      <div className="card">
        <div className="section-title">📋 Custom Knowledge Injection</div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Extra context injected directly into the system prompt. Use this for rules, scope boundaries, pricing tiers, or any structured info you want the AI to always know.
        </p>
        <div className="field mb-0">
          <label>Custom Knowledge (system prompt injection)</label>
          <textarea
            value={customKnowledge}
            onChange={(e) => setCustomKnowledge(e.target.value)}
            rows={12}
            maxLength={5000}
            placeholder={`Examples:\n- Only discuss topics related to our products\n- Do not quote prices without saying 'subject to change'\n- Always recommend contacting sales for enterprise quotes`}
          />
          <div className="hint">{customKnowledge.length} / 5,000 chars — This is in addition to the Knowledge Base articles above.</div>
        </div>
      </div>

      <div className="d-flex" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "Save Scope Rules"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Widget Code Tab
   ═══════════════════════════════════════════════════════════════ */
function WidgetCodeTab({ apiUrl }: { apiUrl: string }) {
  const [copied, setCopied] = useState(false);

  const embedCode = `<!-- ZUDOBOT Widget — paste before </body> -->
<script
  src="${apiUrl.replace("localhost:4000","api.zudogu.com")}/widget/v1/zudobot.min.js"
  data-api-key="YOUR_PUBLIC_KEY"
  data-api-url="${apiUrl}"
  data-tenant-id="YOUR_TENANT_ID"
  defer
></script>`;

  function copyCode() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="card">
        <div className="section-title">🧩 Embed Code</div>
        <div className="info-box">
          วาง code นี้ก่อน <code>&lt;/body&gt;</code> ของทุกหน้าที่ต้องการให้ ZUDOBOT ปรากฏ ใช้เวลาติดตั้งไม่เกิน 1 นาที
        </div>
        <div className="code-block">
          <button className="cb-copy" onClick={copyCode}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{embedCode}</pre>
        </div>
      </div>

      <div className="card">
        <div className="section-title">📌 Attribute Reference</div>
        <table className="rules-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["data-api-key",   "✅", "Public API key จาก tenant credentials"],
              ["data-api-url",   "✅", "URL ของ ZUDOBOT API server"],
              ["data-tenant-id", "✅", "Tenant ID สำหรับโหลด widget config"],
            ].map(([attr, req, desc]) => (
              <tr key={attr}>
                <td><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{attr}</code></td>
                <td>{req}</td>
                <td style={{ color: "var(--slate-600)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">🔧 Programmatic Control</div>
        <div className="code-block">
          <pre>{`// เปิด / ปิด widget จาก JavaScript\nwindow.Zudobot.open();\nwindow.Zudobot.close();`}</pre>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Rules Log Tab
   ═══════════════════════════════════════════════════════════════ */
type ViolationLog = {
  _id: string;
  ruleIds: string[];
  category: string;
  triggerText: string;
  action: "allow" | "block" | "redirect_human" | "emergency";
  layer: "pre" | "post";
  createdAt: string;
};

function RulesLogTab({
  apiFetch,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
}) {
  const [loading, setLoading]       = useState(true);
  const [logs, setLogs]             = useState<ViolationLog[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const pages                       = Math.ceil(total / 20);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await apiFetch(`/api/v1/rules-log?page=${p}&limit=20`);
    if (res.ok && res.data) {
      const d = res.data as { violations: ViolationLog[]; total: number };
      setLogs(d.violations ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => { load(1); }, [load]);

  function goPage(p: number) { setPage(p); load(p); }

  const actionBadge: Record<string, string> = {
    block: "badge badge-block",
    emergency: "badge badge-emergency",
    redirect_human: "badge badge-redirect",
    allow: "badge badge-active",
  };

  return (
    <div>
      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>🚨 Constitutional Rules Violations ({total})</div>
          <button className="btn btn-ghost btn-sm" onClick={() => load(page)}>🔄 Refresh</button>
        </div>
        <div className="info-box">
          บันทึกทุกครั้งที่ svc_zudobotrules ตรวจพบการละเมิดกฎ (Pre-check = user input, Post-check = AI response)
        </div>

        {loading ? (
          <div className="loading-full"><span className="spinner" /> Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-muted" style={{ padding: "28px 0", textAlign: "center" }}>
            ✅ ไม่มีการละเมิดกฎ — ระบบทำงานปกติ
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Rule IDs</th>
                    <th>Category</th>
                    <th>Layer</th>
                    <th>Action</th>
                    <th>Trigger Text</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--slate-400)", fontSize: 11 }}>
                        {new Date(log.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td>
                        <div className="d-flex gap-2" style={{ flexWrap: "wrap" }}>
                          {log.ruleIds.map((r) => (
                            <span key={r} className="badge" style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11 }}>{r}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--slate-600)" }}>{log.category}</td>
                      <td>
                        <span className="badge" style={{ background: log.layer === "pre" ? "#e0f2fe" : "#fce7f3", color: log.layer === "pre" ? "#0369a1" : "#9d174d", fontSize: 11 }}>
                          {log.layer}
                        </span>
                      </td>
                      <td>
                        <span className={actionBadge[log.action] ?? "badge"} style={{ fontSize: 11 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--slate-600)" }}>
                        {log.triggerText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="d-flex gap-2 align-center" style={{ marginTop: 16, justifyContent: "center" }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>← Prev</button>
                <span className="text-muted">Page {page} / {pages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Custom Instructions Tab
   ═══════════════════════════════════════════════════════════════ */
type CustomCommand = {
  _id: string;
  commandType: "SYSTEM_PROMPT_ADDON" | "AUTO_REPLY" | "SALES_STRATEGY";
  label: string;
  triggerKeywords: string[];
  commandContent: string;
  priority: number;
  isActive: boolean;
  validationWarning?: string;
  updatedAt: string;
};

const EMPTY_CMD: Omit<CustomCommand, "_id" | "updatedAt"> = {
  commandType: "SYSTEM_PROMPT_ADDON",
  label: "",
  triggerKeywords: [],
  commandContent: "",
  priority: 50,
  isActive: true,
  validationWarning: "",
};

const CMD_TYPE_LABELS: Record<CustomCommand["commandType"], string> = {
  SYSTEM_PROMPT_ADDON: "📌 System Prompt Add-on",
  AUTO_REPLY:          "💬 Auto-Reply Rule",
  SALES_STRATEGY:      "💰 Sales Strategy",
};

function CustomInstructionsTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]       = useState(true);
  const [commands, setCommands]     = useState<CustomCommand[]>([]);
  const [form, setForm]             = useState<Omit<CustomCommand, "_id" | "updatedAt">>(EMPTY_CMD);
  const [editId, setEditId]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [newKw, setNewKw]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch("/api/v1/custom-commands");
    if (res.ok && res.data) setCommands(((res.data as { data: CustomCommand[] }).data) ?? []);
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  function startEdit(c: CustomCommand) {
    setEditId(c._id);
    setForm({
      commandType: c.commandType, label: c.label,
      triggerKeywords: c.triggerKeywords, commandContent: c.commandContent,
      priority: c.priority, isActive: c.isActive, validationWarning: c.validationWarning,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditId(null); setForm(EMPTY_CMD); setNewKw(""); }

  function addKeyword() {
    const v = newKw.trim();
    if (!v || form.triggerKeywords.includes(v)) return;
    setForm((f) => ({ ...f, triggerKeywords: [...f.triggerKeywords, v] }));
    setNewKw("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.commandContent.trim()) return;
    setSubmitting(true);

    const body = JSON.stringify({
      commandType:     form.commandType,
      label:           form.label.trim(),
      commandContent:  form.commandContent.trim(),
      priority:        form.priority,
      isActive:        form.isActive,
      triggerKeywords: form.triggerKeywords,
    });

    const res = editId
      ? await apiFetch(`/api/v1/custom-commands?id=${editId}`, { method: "PATCH", body })
      : await apiFetch("/api/v1/custom-commands", { method: "POST", body });

    setSubmitting(false);
    if (res.ok) {
      const warn = (res.data as { validationWarning?: string })?.validationWarning;
      if (warn) showToast(warn, "error");
      else showToast(editId ? "Instruction updated ✓" : "Instruction created ✓", "success");
      cancelEdit();
      load();
    } else {
      showToast(res.error ?? "Failed", "error");
    }
  }

  async function deleteCmd(id: string) {
    setDeleteId(id);
    const res = await apiFetch(`/api/v1/custom-commands?id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) { showToast("Deleted ✓", "success"); load(); }
    else showToast(res.error ?? "Delete failed", "error");
  }

  async function toggleActive(c: CustomCommand) {
    const res = await apiFetch(`/api/v1/custom-commands?id=${c._id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (res.ok) load();
    else showToast(res.error ?? "Failed", "error");
  }

  return (
    <div>
      <div className="card">
        <div className="section-title">{editId ? "✏️ Edit Instruction" : "➕ Add Custom Instruction"}</div>
        <div className="info-box">
          Custom Instructions inject additional rules into the AI system prompt as <strong>Layer 3</strong>.
          They are always subordinate to Constitutional Rules (svc_zudobotrules) — any instruction that
          conflicts with a constitutional rule is silently ignored at runtime.
          Use <code style={{ background: "rgba(0,0,0,.06)", padding: "1px 5px", borderRadius: 4 }}>{"{{bot_name}}"}</code> and{" "}
          <code style={{ background: "rgba(0,0,0,.06)", padding: "1px 5px", borderRadius: 4 }}>{"{{shop_name}}"}</code> as dynamic variables.
        </div>
        <form onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select
                value={form.commandType}
                onChange={(e) => setForm((f) => ({ ...f, commandType: e.target.value as CustomCommand["commandType"] }))}
              >
                <option value="SYSTEM_PROMPT_ADDON">📌 System Prompt Add-on</option>
                <option value="AUTO_REPLY">💬 Auto-Reply Rule</option>
                <option value="SALES_STRATEGY">💰 Sales Strategy</option>
              </select>
              <div className="hint">
                {form.commandType === "AUTO_REPLY"     && "Triggered when user message contains a keyword below."}
                {form.commandType === "SALES_STRATEGY" && "Injected into every response to guide sales behavior."}
                {form.commandType === "SYSTEM_PROMPT_ADDON" && "Always appended to the system prompt."}
              </div>
            </div>
            <div className="field">
              <label>Priority (1–100)</label>
              <input
                type="number" min={1} max={100}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              />
              <div className="hint">Higher priority = injected first in Layer 3.</div>
            </div>
            <div className="field d-flex align-center gap-2" style={{ paddingTop: 22 }}>
              <input
                type="checkbox" id="cmdActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "var(--purple)" }}
              />
              <label htmlFor="cmdActive" style={{ cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500, marginBottom: 0 }}>
                Active
              </label>
            </div>
          </div>

          <div className="field">
            <label>Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              maxLength={200}
              placeholder="e.g. Always mention free shipping"
              required
            />
          </div>

          <div className="field">
            <label>Instruction Content</label>
            <textarea
              value={form.commandContent}
              onChange={(e) => setForm((f) => ({ ...f, commandContent: e.target.value }))}
              rows={6}
              maxLength={3000}
              placeholder={`e.g. Always mention that {{shop_name}} offers free shipping on orders over ฿500.\nWhen a customer asks about delivery time, say "1–3 business days".`}
              required
            />
            <div className="hint">{form.commandContent.length} / 3,000 chars</div>
          </div>

          {form.commandType === "AUTO_REPLY" && (
            <div className="field">
              <label>Trigger Keywords</label>
              <div className="tag-list" style={{ marginBottom: 8 }}>
                {form.triggerKeywords.map((kw) => (
                  <span key={kw} className="tag">
                    {kw}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, triggerKeywords: f.triggerKeywords.filter((k) => k !== kw) }))}>×</button>
                  </span>
                ))}
              </div>
              <div className="d-flex gap-2">
                <input
                  style={{ flex: 1, marginBottom: 0 }}
                  className="field"
                  value={newKw}
                  onChange={(e) => setNewKw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="e.g. shipping, delivery, ส่งของ…"
                />
                <button type="button" className="btn btn-ghost" onClick={addKeyword}>Add</button>
              </div>
              {form.triggerKeywords.length === 0 && (
                <div className="hint" style={{ marginTop: 6 }}>No keywords — this rule will always apply (same as SYSTEM_PROMPT_ADDON).</div>
              )}
            </div>
          )}

          {form.validationWarning && (
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 14 }}>
              ⚠ {form.validationWarning}
            </div>
          )}

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : (editId ? "Update Instruction" : "Add Instruction")}
            </button>
            {editId && <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>📋 Instructions ({commands.length})</div>
        </div>

        {loading ? (
          <div className="d-flex align-center gap-2 text-muted" style={{ padding: "20px 0" }}>
            <span className="spinner" /> Loading…
          </div>
        ) : commands.length === 0 ? (
          <div className="text-muted" style={{ padding: "20px 0", textAlign: "center" }}>
            No custom instructions yet. Add one above to extend the bot's behavior.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="kb-table">
              <thead>
                <tr>
                  <th>Label / Preview</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commands.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="title-cell">
                        {c.label}
                        {c.validationWarning && (
                          <span title={c.validationWarning} style={{ marginLeft: 6, color: "#d97706", cursor: "help" }}>⚠</span>
                        )}
                      </div>
                      <div className="content-preview">{c.commandContent}</div>
                      {c.triggerKeywords.length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 2 }}>
                          Keywords: {c.triggerKeywords.join(", ")}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: "#ede9fe", color: "var(--purple)", fontSize: 11, whiteSpace: "nowrap" }}>
                        {CMD_TYPE_LABELS[c.commandType]}
                      </span>
                    </td>
                    <td style={{ color: "var(--slate-600)", fontSize: 13 }}>{c.priority}</td>
                    <td>
                      <button onClick={() => toggleActive(c)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <span className={`badge ${c.isActive ? "badge-active" : "badge-inactive"}`}>
                          {c.isActive ? "active" : "inactive"}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteCmd(c._id)}
                          disabled={deleteId === c._id}
                        >
                          {deleteId === c._id ? <span className="spinner" /> : "Delete"}
                        </button>
                      </div>
                    </td>
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

/* ═══════════════════════════════════════════════════════════════
   LINE Notify Tab
   ═══════════════════════════════════════════════════════════════ */
function LineNotifyTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [testing, setTesting]           = useState(false);
  const [enabled, setEnabled]           = useState(false);
  const [hasToken, setHasToken]         = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [newToken, setNewToken]         = useState("");
  const [showReplace, setShowReplace]   = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/admin/line-notify").then((res) => {
      if (res.ok && res.data) {
        const d = (res.data as { data: { lineNotifyEnabled: boolean; hasToken: boolean; tokenPreview: string | null } }).data;
        setEnabled(d.lineNotifyEnabled);
        setHasToken(d.hasToken);
        setTokenPreview(d.tokenPreview);
      }
      setLoading(false);
    });
  }, [apiFetch]);

  async function save() {
    const body: Record<string, unknown> = { lineNotifyEnabled: enabled };
    if (newToken.trim()) body.lineNotifyToken = newToken.trim();
    setSaving(true);
    const res = await apiFetch("/api/v1/admin/line-notify", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      showToast("LINE Notify settings saved ✓", "success");
      if (newToken.trim()) {
        setHasToken(true);
        setTokenPreview(`••••••••${newToken.trim().slice(-4)}`);
        setNewToken("");
        setShowReplace(false);
      }
    } else {
      showToast(res.error ?? "Save failed", "error");
    }
  }

  async function sendTest() {
    setTesting(true);
    const res = await apiFetch("/api/v1/admin/line-notify", { method: "POST" });
    setTesting(false);
    if (res.ok) showToast("Test notification sent to LINE ✓", "success");
    else showToast(res.error ?? "Test failed — check your token", "error");
  }

  if (loading) return <div className="loading-full"><span className="spinner" /> Loading…</div>;

  return (
    <div>
      <div className="card">
        <div className="section-title">🔔 LINE Notify — Human Handoff Alerts</div>
        <div className="info-box">
          เมื่อ Zudobot ส่งต่อลูกค้าให้ทีมงาน (Human Handoff) ระบบจะส่งการแจ้งเตือนไปยัง LINE ของคุณทันที
          โดยใช้ <strong>LINE Notify Token เฉพาะร้านของคุณ</strong> — ไม่ปะปนกับร้านอื่น
        </div>

        <div className="field">
          <label>LINE Notify Token</label>
          {hasToken && !showReplace ? (
            <div className="d-flex gap-2 align-center">
              <input
                value={tokenPreview ?? ""}
                readOnly
                style={{ flex: 1, background: "var(--slate-100)", color: "var(--slate-400)" }}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReplace(true)}>
                Replace
              </button>
            </div>
          ) : (
            <div className="d-flex gap-2 align-center">
              <input
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="วาง LINE Notify Token ที่นี่"
                style={{ flex: 1 }}
                autoFocus={showReplace}
              />
              {showReplace && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowReplace(false); setNewToken(""); }}>
                  Cancel
                </button>
              )}
            </div>
          )}
          <div className="hint">
            รับ Token ได้ที่{" "}
            <strong style={{ color: "var(--purple)" }}>notify.line.me</strong>
            {" "}→ Login → Generate token → Copy
          </div>
        </div>

        <div className="field d-flex align-center gap-2" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            id="lineEnabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--purple)" }}
          />
          <label
            htmlFor="lineEnabled"
            style={{ cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500, marginBottom: 0 }}
          >
            เปิดใช้งาน LINE Notify Alert
          </label>
        </div>
      </div>

      <div className="card">
        <div className="section-title">📋 รูปแบบข้อความแจ้งเตือน</div>
        <div className="code-block">
          <pre style={{ whiteSpace: "pre-wrap" }}>{`🔔 Zudobot Human Handoff
ร้าน: [ชื่อร้านค้า]
Session: [sessionId]
Visitor: [visitorId หรือ anonymous]
ข้อความ: [ข้อความล่าสุดของลูกค้า 200 ตัวอักษร]`}</pre>
        </div>
        <p className="text-muted" style={{ marginTop: 12 }}>
          Trigger: เมื่อ Bot ตอบว่า "ได้แจ้งทีมงานให้ติดต่อกลับ" — เกิดขึ้นเมื่อลูกค้าขอคุยกับคน, ร้องเรียน หรือถามในสิ่งที่ Bot ไม่มีสิทธิ์ตัดสินใจ
        </p>
      </div>

      <div className="d-flex gap-2" style={{ justifyContent: "flex-end" }}>
        <button
          className="btn btn-ghost"
          onClick={sendTest}
          disabled={testing || !hasToken}
          title={!hasToken ? "Add a token first" : "Send test notification to LINE"}
        >
          {testing ? <><span className="spinner" /> Sending…</> : "📩 Test Notification"}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "Save LINE Settings"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Products Tab
   ═══════════════════════════════════════════════════════════════ */
type Product = {
  _id: string;
  name: string;
  price: number;
  priceSuffix: string;
  shortDescription: string;
  slug: string;
  stock: number | null;
  variants: string[];
  isActive: boolean;
  embeddedAt: string | null;
  updatedAt: string;
};

const EMPTY_PRODUCT: Omit<Product, "_id" | "embeddedAt" | "updatedAt"> = {
  name: "", price: 0, priceSuffix: "", shortDescription: "",
  slug: "", stock: null, variants: [], isActive: true,
};

function formatPrice(p: Product): string {
  if (p.price === -1) return "ติดต่อสอบถาม";
  if (p.price === 0)  return "ฟรี";
  return `฿${p.price.toLocaleString()}${p.priceSuffix}`;
}

function ProductsTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]       = useState(true);
  const [products, setProducts]     = useState<Product[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [q, setQ]                   = useState("");
  const [form, setForm]             = useState<Omit<Product, "_id" | "embeddedAt" | "updatedAt">>(EMPTY_PRODUCT);
  const [editId, setEditId]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [embedding, setEmbedding]   = useState(false);
  const [variantInput, setVariantInput] = useState("");
  const pages = Math.ceil(total / 20);

  const load = useCallback(async (p = 1, search = q) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(p), limit: "20" });
    if (search) qs.set("q", search);
    const res = await apiFetch(`/api/v1/admin/products?${qs}`);
    if (res.ok && res.data) {
      const d = res.data as { data: Product[]; total: number };
      setProducts(d.data ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [apiFetch, q]);

  useEffect(() => { load(1); }, [load]);

  function startEdit(p: Product) {
    setEditId(p._id);
    setForm({
      name: p.name, price: p.price, priceSuffix: p.priceSuffix,
      shortDescription: p.shortDescription, slug: p.slug,
      stock: p.stock, variants: p.variants, isActive: p.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditId(null); setForm(EMPTY_PRODUCT); setVariantInput(""); }

  function addVariant() {
    const v = variantInput.trim();
    if (!v || form.variants.includes(v)) return;
    setForm((f) => ({ ...f, variants: [...f.variants, v] }));
    setVariantInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    const body = JSON.stringify({
      name:             form.name.trim(),
      price:            form.price,
      priceSuffix:      form.priceSuffix,
      shortDescription: form.shortDescription.trim(),
      slug:             form.slug.trim(),
      stock:            form.stock,
      variants:         form.variants,
      isActive:         form.isActive,
    });
    const res = editId
      ? await apiFetch(`/api/v1/admin/products?id=${editId}`, { method: "PATCH", body })
      : await apiFetch("/api/v1/admin/products", { method: "POST", body });
    setSubmitting(false);
    if (res.ok) {
      showToast(editId ? "Product updated ✓" : "Product added ✓", "success");
      cancelEdit();
      load(page);
    } else {
      showToast(res.error ?? "Failed", "error");
    }
  }

  async function deleteProduct(id: string) {
    setDeleteId(id);
    const res = await apiFetch(`/api/v1/admin/products?id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) { showToast("Deleted ✓", "success"); load(page); }
    else showToast(res.error ?? "Delete failed", "error");
  }

  async function toggleActive(p: Product) {
    const res = await apiFetch(`/api/v1/admin/products?id=${p._id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) load(page);
    else showToast(res.error ?? "Failed", "error");
  }

  async function reEmbedAll() {
    setEmbedding(true);
    const res = await apiFetch("/api/v1/admin/products/embed", { method: "POST" });
    setEmbedding(false);
    if (res.ok) {
      const d = res.data as { message: string };
      showToast(d.message ?? "Re-embed complete ✓", "success");
      load(page);
    } else {
      showToast(res.error ?? "Embed failed", "error");
    }
  }

  function goPage(p: number) { setPage(p); load(p); }

  return (
    <div>
      {/* Add / Edit form */}
      <div className="card">
        <div className="section-title">{editId ? "✏️ Edit Product" : "➕ Add Product"}</div>
        <form onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label>Product Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={300}
                placeholder="e.g. Dives Space Pro Plan"
                required
              />
            </div>
            <div className="field">
              <label>Slug (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. pro-plan"
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Price (฿)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
              />
              <div className="hint">-1 = ติดต่อสอบถาม &nbsp;|&nbsp; 0 = ฟรี</div>
            </div>
            <div className="field">
              <label>Price Suffix</label>
              <input
                value={form.priceSuffix}
                onChange={(e) => setForm((f) => ({ ...f, priceSuffix: e.target.value }))}
                placeholder="/เดือน, /ชิ้น, /ปี…"
              />
            </div>
            <div className="field">
              <label>Stock</label>
              <input
                type="number"
                value={form.stock ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="(leave blank = unlimited)"
              />
            </div>
          </div>

          <div className="field">
            <label>Short Description</label>
            <textarea
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
              rows={3}
              maxLength={2000}
              placeholder="Brief description used in RAG search and bot responses"
            />
            <div className="hint">{form.shortDescription.length} / 2,000 chars — ยิ่งละเอียด RAG ยิ่งแม่นยำ</div>
          </div>

          <div className="field">
            <label>Variants / Options</label>
            <div className="tag-list" style={{ marginBottom: 8 }}>
              {form.variants.map((v) => (
                <span key={v} className="tag">
                  {v}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((x) => x !== v) }))}>×</button>
                </span>
              ))}
            </div>
            <div className="d-flex gap-2">
              <input
                className="field"
                style={{ flex: 1, marginBottom: 0 }}
                value={variantInput}
                onChange={(e) => setVariantInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariant(); } }}
                placeholder="e.g. สีแดง, ไซส์ M, 1 ปี…"
              />
              <button type="button" className="btn btn-ghost" onClick={addVariant}>Add</button>
            </div>
          </div>

          <div className="field d-flex align-center gap-2" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              id="prodActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "var(--purple)" }}
            />
            <label htmlFor="prodActive" style={{ cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500, marginBottom: 0 }}>
              Active (แสดงในแคตาล็อก)
            </label>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : (editId ? "Update Product" : "Add Product")}
            </button>
            {editId && <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* Product list */}
      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>🛍️ Catalog ({total})</div>
          <div className="d-flex gap-2 align-center">
            <input
              style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--slate-200)", fontSize: 13, outline: "none" }}
              placeholder="Search products…"
              value={q}
              onChange={(e) => { setQ(e.target.value); load(1, e.target.value); }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={reEmbedAll}
              disabled={embedding}
              title="Re-embed all products with Gemini text-embedding-004 for RAG semantic search"
            >
              {embedding ? <><span className="spinner" /> Embedding…</> : "⚡ Re-embed All"}
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginBottom: 16 }}>
          Bot จะค้นหาสินค้าที่เกี่ยวข้องกับคำถามของลูกค้าแบบ Semantic Search ผ่าน Atlas Vector Search
          คลิก <strong>Re-embed All</strong> ทุกครั้งที่เพิ่ม/แก้ไขสินค้าจำนวนมาก
          หรือรอระบบ Auto-embed ซึ่งทำงานอัตโนมัติเมื่อบันทึกสินค้าแต่ละชิ้น
        </div>

        {loading ? (
          <div className="d-flex align-center gap-2 text-muted" style={{ padding: "20px 0" }}>
            <span className="spinner" /> Loading…
          </div>
        ) : products.length === 0 ? (
          <div className="text-muted" style={{ padding: "20px 0", textAlign: "center" }}>
            No products yet. Add your first product above to enable RAG semantic search.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="kb-table">
                <thead>
                  <tr>
                    <th>Name / Description</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Embedded</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="title-cell">{p.name}</div>
                        {p.shortDescription && (
                          <div className="content-preview">{p.shortDescription}</div>
                        )}
                        {p.variants.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 2 }}>
                            {p.variants.join(" · ")}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatPrice(p)}</td>
                      <td style={{ color: "var(--slate-600)", fontSize: 13 }}>
                        {p.stock === null ? "∞" : p.stock <= 0 ? <span style={{ color: "var(--red)" }}>หมด</span> : p.stock}
                      </td>
                      <td>
                        {p.embeddedAt ? (
                          <span className="badge badge-active" style={{ fontSize: 11 }} title={`Embedded ${new Date(p.embeddedAt).toLocaleDateString()}`}>
                            ✓ embedded
                          </span>
                        ) : (
                          <span className="badge badge-inactive" style={{ fontSize: 11 }}>
                            ⏳ pending
                          </span>
                        )}
                      </td>
                      <td>
                        <button onClick={() => toggleActive(p)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                          <span className={`badge ${p.isActive ? "badge-active" : "badge-inactive"}`}>
                            {p.isActive ? "active" : "inactive"}
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteProduct(p._id)}
                            disabled={deleteId === p._id}
                          >
                            {deleteId === p._id ? <span className="spinner" /> : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="d-flex gap-2 align-center" style={{ marginTop: 16, justifyContent: "center" }}>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>← Prev</button>
                <span className="text-muted">Page {page} / {pages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Analytics Tab
   ═══════════════════════════════════════════════════════════════ */
type AnalyticsOverview = {
  totalSessions: number; recentSessions: number; totalMessages: number;
  handoffSessions: number; handoffRate: number;
  sentimentAvg: number; violationCount: number; unresolvedGaps: number;
};
type GapRow      = { query: string; frequency: number; createdAt: string };
type DailyRow    = { _id: string; sessions: number; messages: number };
type ViolCatRow  = { _id: string; count: number };

function AnalyticsTab({
  apiFetch,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
}) {
  const [days, setDays]           = useState(30);
  const [loading, setLoading]     = useState(true);
  const [overview, setOverview]   = useState<AnalyticsOverview | null>(null);
  const [gaps, setGaps]           = useState<GapRow[]>([]);
  const [daily, setDaily]         = useState<DailyRow[]>([]);
  const [violCats, setViolCats]   = useState<ViolCatRow[]>([]);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    const res = await apiFetch(`/api/v1/admin/analytics?days=${d}`);
    setLoading(false);
    if (res.ok && res.data) {
      const payload = (res.data as { data: { overview: AnalyticsOverview; topGaps: GapRow[]; dailyVolume: DailyRow[]; violationsByCategory: ViolCatRow[] } }).data;
      setOverview(payload.overview);
      setGaps(payload.topGaps);
      setDaily(payload.dailyVolume);
      setViolCats(payload.violationsByCategory);
    }
  }, [apiFetch]);

  useEffect(() => { load(days); }, [load, days]);

  const maxMsg = Math.max(1, ...daily.map((d) => d.messages));

  function sentimentColor(s: number) {
    if (s >= 5) return "#22c55e";
    if (s >= 0) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="tab-content">
      <div className="d-flex align-center gap-2" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📊 Analytics</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {([7, 30, 90] as const).map((d) => (
            <button key={d} className={`btn btn-sm ${days === d ? "btn-primary" : "btn-ghost"}`}
              onClick={() => { setDays(d); load(d); }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-muted">Loading analytics…</div>}

      {!loading && overview && (
        <>
          {/* Overview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Sessions", value: overview.recentSessions, sub: `${overview.totalSessions} all-time` },
              { label: "Messages", value: overview.totalMessages },
              { label: "Handoffs", value: overview.handoffSessions, sub: `${overview.handoffRate}% rate` },
              { label: "Sentiment Avg", value: overview.sentimentAvg.toFixed(1), color: sentimentColor(overview.sentimentAvg) },
              { label: "Violations", value: overview.violationCount },
              { label: "Knowledge Gaps", value: overview.unresolvedGaps, sub: "unresolved" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "var(--fg)" }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Daily volume bar chart */}
          {daily.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">Daily Message Volume</div>
              <div className="card-body" style={{ overflowX: "auto" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, minWidth: daily.length * 28 }}>
                  {daily.map((d) => (
                    <div key={d._id} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <div title={`${d.messages} messages`} style={{
                        width: "100%", background: "var(--purple)",
                        height: `${Math.max(4, Math.round((d.messages / maxMsg) * 72))}px`,
                        borderRadius: "3px 3px 0 0", opacity: 0.8,
                      }} />
                      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3, transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap" }}>
                        {d._id.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Top knowledge gaps */}
            <div className="card">
              <div className="card-header">Top Knowledge Gaps</div>
              <div className="card-body" style={{ padding: 0 }}>
                {gaps.length === 0
                  ? <div className="text-muted" style={{ padding: 16 }}>No gaps logged yet.</div>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Query</th>
                          <th style={{ textAlign: "right", padding: "8px 16px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Asked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gaps.map((g, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 16px", fontSize: 13 }}>{g.query.slice(0, 60)}{g.query.length > 60 ? "…" : ""}</td>
                            <td style={{ padding: "8px 16px", fontSize: 13, textAlign: "right", fontWeight: 600 }}>{g.frequency}×</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>
            </div>

            {/* Violations by category */}
            <div className="card">
              <div className="card-header">Rule Violations by Category</div>
              <div className="card-body" style={{ padding: 0 }}>
                {violCats.length === 0
                  ? <div className="text-muted" style={{ padding: 16 }}>No violations in this period.</div>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Category</th>
                          <th style={{ textAlign: "right", padding: "8px 16px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violCats.map((v, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 16px", fontSize: 13 }}>{v._id}</td>
                            <td style={{ padding: "8px 16px", fontSize: 13, textAlign: "right", fontWeight: 600, color: "var(--red)" }}>{v.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Visitors Tab (CRM)
   ═══════════════════════════════════════════════════════════════ */
type VisitorRow = {
  _id: string;
  visitorId: string;
  tags: string[];
  sessionCount: number;
  totalMessages: number;
  sentimentAvg: number;
  lastSentiment: number;
  handoffCount: number;
  lastSeenAt: string;
  firstSeenAt: string;
  lastMessage: string;
  notes: string;
};

const TAG_COLORS: Record<string, string> = {
  hot_lead:          "#ef4444",
  prospect:          "#f97316",
  price_shopper:     "#eab308",
  comparison:        "#3b82f6",
  budget_sensitive:  "#8b5cf6",
  repeat_visitor:    "#22c55e",
  handoff_requested: "#ec4899",
  vip:               "#6366f1",
};

function VisitorsTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]     = useState(true);
  const [visitors, setVisitors]   = useState<VisitorRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [filterTag, setFilterTag] = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [noteEdit, setNoteEdit]   = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState<string | null>(null);

  const load = useCallback(async (p: number, tag: string) => {
    setLoading(true);
    const qs = tag ? `&tag=${tag}` : "";
    const res = await apiFetch(`/api/v1/admin/visitors?page=${p}&limit=20${qs}`);
    setLoading(false);
    if (res.ok && res.data) {
      const d = res.data as { visitors: VisitorRow[]; total: number; pages: number };
      setVisitors(d.visitors);
      setTotal(d.total);
      setPages(d.pages);
    }
  }, [apiFetch]);

  useEffect(() => { load(page, filterTag); }, [load, page, filterTag]);

  async function saveNotes(visitorId: string) {
    setSaving(visitorId);
    const res = await apiFetch("/api/v1/admin/visitors", {
      method: "PATCH",
      body: JSON.stringify({ visitorId, notes: noteEdit[visitorId] ?? "" }),
    });
    setSaving(null);
    if (res.ok) { showToast("Notes saved ✓", "success"); load(page, filterTag); }
    else showToast(res.error ?? "Save failed", "error");
  }

  async function addTag(visitorId: string, tag: string) {
    const res = await apiFetch("/api/v1/admin/visitors", {
      method: "PATCH",
      body: JSON.stringify({ visitorId, addTags: [tag] }),
    });
    if (res.ok) load(page, filterTag);
    else showToast(res.error ?? "Failed", "error");
  }

  async function removeTag(visitorId: string, tag: string) {
    const res = await apiFetch("/api/v1/admin/visitors", {
      method: "PATCH",
      body: JSON.stringify({ visitorId, removeTags: [tag] }),
    });
    if (res.ok) load(page, filterTag);
    else showToast(res.error ?? "Failed", "error");
  }

  function sentimentIcon(s: number) {
    if (s >= 5) return "😊";
    if (s >= 0) return "😐";
    return "😟";
  }

  return (
    <div className="tab-content">
      <div className="d-flex align-center gap-2" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>👥 Visitors <span className="badge">{total}</span></h2>
        <select className="input" style={{ marginLeft: "auto", width: 180 }}
          value={filterTag} onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}>
          <option value="">All visitors</option>
          {Object.keys(TAG_COLORS).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-muted">Loading visitors…</div>}

      {!loading && visitors.length === 0 && (
        <div className="empty-state">No visitor profiles yet. Profiles are created when customers chat with a visitorId.</div>
      )}

      {!loading && visitors.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visitors.map((v) => {
              const isOpen = expanded === v.visitorId;
              return (
                <div key={v.visitorId} className="card" style={{ padding: 0 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                    onClick={() => { setExpanded(isOpen ? null : v.visitorId); setNoteEdit((n) => ({ ...n, [v.visitorId]: v.notes })); }}
                  >
                    <div style={{ fontSize: 22 }}>{sentimentIcon(v.lastSentiment)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v.visitorId}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {v.sessionCount} session{v.sessionCount !== 1 ? "s" : ""} · {v.totalMessages} messages · last seen {new Date(v.lastSeenAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 300, justifyContent: "flex-end" }}>
                      {v.tags.map((tag) => (
                        <span key={tag} style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: TAG_COLORS[tag] ?? "#6b7280", color: "#fff",
                        }}>{tag.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>{isOpen ? "▲" : "▼"}</div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
                      {v.lastMessage && (
                        <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--bg-alt)", borderRadius: 6, fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                          "{v.lastMessage}"
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                        {[
                          { label: "First seen", value: new Date(v.firstSeenAt).toLocaleDateString() },
                          { label: "Last sentiment", value: `${v.lastSentiment > 0 ? "+" : ""}${v.lastSentiment}` },
                          { label: "Handoffs", value: String(v.handoffCount) },
                          { label: "Total messages", value: String(v.totalMessages) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Tags</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {v.tags.map((tag) => (
                            <span key={tag} style={{
                              display: "flex", alignItems: "center", gap: 4,
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                              background: TAG_COLORS[tag] ?? "#6b7280", color: "#fff",
                            }}>
                              {tag.replace(/_/g, " ")}
                              <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, lineHeight: 1 }}
                                onClick={(e) => { e.stopPropagation(); removeTag(v.visitorId, tag); }}>×</button>
                            </span>
                          ))}
                          <select className="input" style={{ width: 140, fontSize: 11, padding: "2px 6px", height: 26 }}
                            value="" onChange={(e) => { if (e.target.value) addTag(v.visitorId, e.target.value); }}>
                            <option value="">+ Add tag</option>
                            {Object.keys(TAG_COLORS).filter((t) => !v.tags.includes(t)).map((t) => (
                              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Notes</div>
                        <textarea
                          className="input textarea"
                          rows={2}
                          placeholder="Internal notes about this visitor…"
                          value={noteEdit[v.visitorId] ?? v.notes}
                          onChange={(e) => setNoteEdit((n) => ({ ...n, [v.visitorId]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          style={{ resize: "vertical" }}
                        />
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }}
                          disabled={saving === v.visitorId}
                          onClick={(e) => { e.stopPropagation(); saveNotes(v.visitorId); }}>
                          {saving === v.visitorId ? <span className="spinner" /> : "Save Notes"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="d-flex gap-2 align-center" style={{ marginTop: 16, justifyContent: "center" }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span className="text-muted">Page {page} / {pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Usage & Plans Tab
   ═══════════════════════════════════════════════════════════════ */
type MemIndexStatus = {
  indexed:                 boolean;
  indexError?:             string;
  usedVisitorMemory:       number;
  totalVisitorMemoryQuota: number;
  isMemoryFull:            boolean;
  setupInstructions: null | {
    step1: string; step2: string; step3: string;
    indexDefinition: unknown;
  };
};

type UsageData = {
  activePackageSlug:       string;
  totalMessageQuota:       number;
  usedMessages:            number;
  messageUsagePercent:     number;
  totalVisitorMemoryQuota: number;
  usedVisitorMemory:       number;
  memoryUsagePercent:      number;
  isMemoryFull:            boolean;
  cycleStartDate:          string | null;
  cycleEndDate:            string | null;
  daysUntilReset:          number;
  isInGracePeriod?:        boolean;
  gracePeriodRemaining?:   number;
  addons:                  { packageSlug: string; quotaGranted: number; purchasedAt: string }[];
  purchases:               { packageSlug: string; packageName: string; amount: number; purchasedAt: string; validTo: string | null }[];
};

type PackageDef = {
  slug: string; name: string; description: string; price: number;
  messageQuota: number; visitorMemoryQuota: number; billingCycle: string;
};

type PackagesData = {
  basePlans: PackageDef[];
  addonMsg:  PackageDef[];
  addonMem:  PackageDef[];
};

function UsageBar({ percent, color }: { percent: number; color: string }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div style={{ background: "var(--slate-100)", borderRadius: 6, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.4s" }} />
    </div>
  );
}

function barColor(pct: number) {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f97316";
  return "#9333ea";
}

function UsageTab({
  apiFetch,
  showToast,
}: {
  apiFetch: (path: string, opts?: RequestInit) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading]       = useState(true);
  const [usage, setUsage]           = useState<UsageData | null>(null);
  const [packages, setPackages]     = useState<PackagesData | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [memStatus, setMemStatus]   = useState<MemIndexStatus | null>(null);
  const [memChecking, setMemChecking] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/admin/usage"),
      apiFetch("/api/v1/admin/packages"),
    ]).then(([ur, pr]) => {
      if (ur.ok && ur.data) setUsage((ur.data as { data: UsageData }).data);
      if (pr.ok && pr.data) setPackages((pr.data as { data: PackagesData }).data);
      setLoading(false);
    });
  }, [apiFetch]);

  async function checkMemIndex() {
    setMemChecking(true);
    const res = await apiFetch("/api/v1/admin/memory/status");
    setMemChecking(false);
    if (res.ok && res.data) setMemStatus((res.data as { data: MemIndexStatus }).data);
  }

  async function purchase(slug: string) {
    const pkg = [
      ...(packages?.basePlans ?? []),
      ...(packages?.addonMsg  ?? []),
      ...(packages?.addonMem  ?? []),
    ].find((p) => p.slug === slug);
    if (!pkg) return;
    setPurchasing(slug);
    const res = await apiFetch("/api/v1/admin/packages/purchase", {
      method: "POST",
      body: JSON.stringify({ packageSlug: slug, amount: pkg.price, note: "Dashboard upgrade" }),
    });
    setPurchasing(null);
    if (res.ok) {
      showToast(`Package "${pkg.name}" activated ✓`, "success");
      const ur = await apiFetch("/api/v1/admin/usage");
      if (ur.ok && ur.data) setUsage((ur.data as { data: UsageData }).data);
    } else {
      showToast(res.error ?? "Purchase failed", "error");
    }
  }

  if (loading) return <div className="loading-full"><span className="spinner" /> Loading…</div>;

  const msgColor = barColor(usage?.messageUsagePercent ?? 0);
  const memColor = barColor(usage?.memoryUsagePercent  ?? 0);

  return (
    <div>
      {/* Warnings */}
      {usage?.isInGracePeriod && (
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <strong style={{ color: "#92400e" }}>Grace Period Active</strong>
            <div style={{ fontSize: 13, color: "#78350f" }}>
              เกินโควต้าแล้ว — เหลือข้อความในช่วง Grace {usage.gracePeriodRemaining ?? 0} ข้อความ อัปเกรดเพื่อไม่ให้บริการหยุดชะงัก
            </div>
          </div>
        </div>
      )}
      {usage?.isMemoryFull && (
        <div style={{ background: "#fce7f3", border: "1px solid #ec4899", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <div>
            <strong style={{ color: "#831843" }}>Memory Full</strong>
            <div style={{ fontSize: 13, color: "#9d174d" }}>
              ระบบถึงขีดจำกัดการจำลูกค้าแล้ว — ข้อมูลใหม่จะถูก evict ทับข้อมูลเก่า ซื้อ Memory Add-on เพื่อเพิ่มความจุ
            </div>
          </div>
        </div>
      )}

      {/* Usage summary card */}
      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>📊 Current Billing Cycle</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Plan</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--purple)", textTransform: "capitalize" }}>
              {usage?.activePackageSlug?.replace(/_/g, " ") ?? "Trial"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ padding: "12px 14px", background: "var(--bg-alt)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Cycle Resets</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{usage?.daysUntilReset ?? "—"}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>days</div>
          </div>
          <div className="card" style={{ padding: "12px 14px", background: "var(--bg-alt)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Messages Used</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: msgColor }}>
              {usage?.usedMessages ?? 0}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}> / {usage?.totalMessageQuota ?? 0}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{usage?.messageUsagePercent ?? 0}%</div>
          </div>
          <div className="card" style={{ padding: "12px 14px", background: "var(--bg-alt)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Customer Memory</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: memColor }}>
              {usage?.usedVisitorMemory ?? 0}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}> / {usage?.totalVisitorMemoryQuota ?? 0}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>visitors</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div className="d-flex justify-between" style={{ marginBottom: 5, fontSize: 12 }}>
              <span>Messages {usage?.messageUsagePercent ?? 0}%</span>
              <span style={{ color: "var(--muted)" }}>
                {usage?.usedMessages ?? 0} / {usage?.totalMessageQuota ?? 0}
              </span>
            </div>
            <UsageBar percent={usage?.messageUsagePercent ?? 0} color={msgColor} />
          </div>
          {(usage?.totalVisitorMemoryQuota ?? 0) > 0 && (
            <div>
              <div className="d-flex justify-between" style={{ marginBottom: 5, fontSize: 12 }}>
                <span>Memory {usage?.memoryUsagePercent ?? 0}%</span>
                <span style={{ color: "var(--muted)" }}>
                  {usage?.usedVisitorMemory ?? 0} / {usage?.totalVisitorMemoryQuota ?? 0} visitors
                </span>
              </div>
              <UsageBar percent={usage?.memoryUsagePercent ?? 0} color={memColor} />
            </div>
          )}
        </div>

        {usage?.cycleStartDate && usage?.cycleEndDate && (
          <div className="d-flex justify-between" style={{ marginTop: 14, fontSize: 11, color: "var(--muted)" }}>
            <span>Cycle started: {new Date(usage.cycleStartDate).toLocaleDateString()}</span>
            <span>Resets: {new Date(usage.cycleEndDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Base Plan Upgrade */}
      {packages && packages.basePlans.length > 0 && (
        <div className="card">
          <div className="section-title">🚀 Upgrade Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {packages.basePlans.map((p) => {
              const isActive = usage?.activePackageSlug === p.slug;
              return (
                <div key={p.slug} style={{
                  border: `2px solid ${isActive ? "var(--purple)" : "var(--border)"}`,
                  borderRadius: 10, padding: "16px 14px",
                  background: isActive ? "#faf5ff" : "var(--bg)",
                  opacity: p.slug === "trial" ? 0.6 : 1,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {isActive && <span style={{ color: "var(--purple)", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✓ ACTIVE</span>}
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{p.description}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                    {p.price === 0 ? "Free" : `฿${p.price.toLocaleString()}/mo`}
                  </div>
                  <button
                    className={`btn btn-sm ${isActive ? "btn-ghost" : "btn-primary"}`}
                    style={{ width: "100%" }}
                    disabled={isActive || p.slug === "trial" || purchasing === p.slug}
                    onClick={() => purchase(p.slug)}
                  >
                    {purchasing === p.slug ? <span className="spinner" /> : isActive ? "Current Plan" : "Activate"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add-ons */}
      {packages && (packages.addonMsg.length > 0 || packages.addonMem.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {packages.addonMsg.length > 0 && (
            <div className="card">
              <div className="section-title">💬 Message Add-ons</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {packages.addonMsg.map((p) => (
                  <div key={p.slug} className="d-flex align-center justify-between" style={{ padding: "10px 12px", background: "var(--bg-alt)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>+{p.messageQuota.toLocaleString()} messages</div>
                    </div>
                    <div className="d-flex align-center gap-2">
                      <span style={{ fontWeight: 700, fontSize: 14 }}>฿{p.price}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={purchasing === p.slug}
                        onClick={() => purchase(p.slug)}
                      >
                        {purchasing === p.slug ? <span className="spinner" /> : "Buy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {packages.addonMem.length > 0 && (
            <div className="card">
              <div className="section-title">🧠 Memory Add-ons</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {packages.addonMem.map((p) => (
                  <div key={p.slug} className="d-flex align-center justify-between" style={{ padding: "10px 12px", background: "var(--bg-alt)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>+{p.visitorMemoryQuota.toLocaleString()} visitors</div>
                    </div>
                    <div className="d-flex align-center gap-2">
                      <span style={{ fontWeight: 700, fontSize: 14 }}>฿{p.price}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={purchasing === p.slug}
                        onClick={() => purchase(p.slug)}
                      >
                        {purchasing === p.slug ? <span className="spinner" /> : "Buy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Add-ons */}
      {(usage?.addons?.length ?? 0) > 0 && (
        <div className="card">
          <div className="section-title">🎁 Active Add-ons</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Package", "Quota Granted", "Purchased"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage!.addons.map((a, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px" }}>{a.packageSlug.replace(/_/g, " ")}</td>
                  <td style={{ padding: "8px 12px" }}>{a.quotaGranted.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{new Date(a.purchasedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase history */}
      {(usage?.purchases?.length ?? 0) > 0 && (
        <div className="card">
          <div className="section-title">🧾 Recent Purchases</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Package", "Amount", "Date", "Expires"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage!.purchases.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px" }}>{p.packageName}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>฿{p.amount.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{new Date(p.purchasedAt).toLocaleDateString()}</td>
                  <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{p.validTo ? new Date(p.validTo).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Atlas Vector Search Index Status */}
      <div className="card">
        <div className="d-flex align-center justify-between" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>🔍 Customer Memory Index (Atlas)</div>
          <button className="btn btn-ghost btn-sm" onClick={checkMemIndex} disabled={memChecking}>
            {memChecking ? <><span className="spinner" /> Checking…</> : "Check Status"}
          </button>
        </div>

        {!memStatus && !memChecking && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            กด <strong>Check Status</strong> เพื่อตรวจสอบว่า Atlas Vector Search Index พร้อมใช้งานหรือยัง
          </div>
        )}

        {memStatus && (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              borderRadius: 8, marginBottom: 14,
              background: memStatus.indexed ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${memStatus.indexed ? "#86efac" : "#fca5a5"}`,
            }}>
              <span style={{ fontSize: 20 }}>{memStatus.indexed ? "✅" : "❌"}</span>
              <div>
                <strong style={{ color: memStatus.indexed ? "#15803d" : "#b91c1c" }}>
                  {memStatus.indexed ? "Index Ready — Customer Memory Active" : "Index Not Found — Memory RAG Disabled"}
                </strong>
                {!memStatus.indexed && memStatus.indexError && (
                  <div style={{ fontSize: 11, color: "#9f1239", marginTop: 2, fontFamily: "monospace" }}>
                    {memStatus.indexError.slice(0, 120)}
                  </div>
                )}
              </div>
            </div>

            {memStatus.indexed && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Stored Memories", value: String(memStatus.usedVisitorMemory) },
                  { label: "Memory Quota", value: String(memStatus.totalVisitorMemoryQuota) },
                  { label: "Status", value: memStatus.isMemoryFull ? "⚠ Full" : "✓ Available", color: memStatus.isMemoryFull ? "var(--red)" : "#15803d" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ padding: "10px 12px", background: "var(--bg-alt)" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "var(--fg)" }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {!memStatus.indexed && memStatus.setupInstructions && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--fg)" }}>
                  วิธีสร้าง Index ใน MongoDB Atlas:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {[memStatus.setupInstructions.step1, memStatus.setupInstructions.step2, memStatus.setupInstructions.step3].map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: "var(--purple)", minWidth: 20 }}>{i + 1}.</span>
                      <span>{s}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: "var(--purple)", minWidth: 20 }}>4.</span>
                    <span>วาง JSON ด้านล่างในช่อง Index Definition แล้วกด Create</span>
                  </div>
                </div>
                <div className="code-block">
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, margin: 0 }}>
                    {JSON.stringify(memStatus.setupInstructions.indexDefinition, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
