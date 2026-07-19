"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlatformName = "line" | "facebook" | "instagram" | "tiktok";

interface PlatformStat {
  connected:    number;
  enabled:      number;
  activeTokens: number;
}

interface OverviewData {
  totalTenants:  number;
  activeTokens:  number;
  platforms: Record<PlatformName, PlatformStat>;
}

interface TenantRow {
  tenantId:     string;
  businessName: string;
  websiteUrl:   string;
  botName:      string;
  email:        string;
  line:    { enabled: boolean; connected: boolean; hasToken: boolean; liffId: string };
  meta:    { enabled: boolean; connected: boolean; hasToken: boolean; pageId: string; verifySet: boolean };
  tiktok:  { enabled: boolean; connected: boolean; hasSecret: boolean };
}

interface ActivityRow {
  tenantId:       string;
  businessName:   string;
  platformName:   PlatformName;
  displayName:    string;
  initialMessage: string;
  expiresAt:      string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<PlatformName, { label: string; color: string; bg: string; icon: string }> = {
  line:      { label: "LINE OA",          color: "text-green-700",  bg: "bg-green-50",  icon: "💬" },
  facebook:  { label: "Facebook",         color: "text-blue-700",   bg: "bg-blue-50",   icon: "📘" },
  instagram: { label: "Instagram",        color: "text-pink-700",   bg: "bg-pink-50",   icon: "📸" },
  tiktok:    { label: "TikTok",           color: "text-slate-700",  bg: "bg-slate-100", icon: "🎵" },
};

const BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "";

function webhookUrl(platform: PlatformName, tenantId: string) {
  const path = platform === "facebook" || platform === "instagram" ? "meta" : platform;
  return `${BASE_URL}/api/webhooks/${path}/${tenantId}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-gray-400"}`} />
      {label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] px-1.5 py-0.5 rounded border border-border-default hover:bg-surface-secondary transition-colors text-text-muted"
    >
      {copied ? "✓" : "Copy"}
    </button>
  );
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData]     = useState<OverviewData | null>(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    fetch("/api/admin/omni-chat?tab=overview")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <div className="text-sm text-text-muted py-8 text-center">กำลังโหลด…</div>;
  if (!data)   return <div className="text-sm text-red-500 py-8 text-center">โหลดข้อมูลไม่สำเร็จ</div>;

  const platforms: PlatformName[] = ["line", "facebook", "instagram", "tiktok"];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Tenants ทั้งหมด"    value={data.totalTenants} icon="👥" color="brand" />
        <SummaryCard label="Active Deep-Link Tokens" value={data.activeTokens} icon="🔗" color="green" />
        <SummaryCard
          label="Channels Connected"
          value={Object.values(data.platforms).reduce((s, p) => s + p.connected, 0)}
          icon="📡"
          color="blue"
        />
        <SummaryCard
          label="Channels Enabled"
          value={Object.values(data.platforms).reduce((s, p) => s + p.enabled, 0)}
          icon="✅"
          color="purple"
        />
      </div>

      {/* Per-platform cards */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">สถานะแต่ละ Platform</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((pf) => {
            const stat = data.platforms[pf];
            const meta = PLATFORM_META[pf];
            return (
              <div key={pf} className={`rounded-xl border border-border-default p-4 ${meta.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{meta.icon}</span>
                  <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                </div>
                <div className="space-y-1.5 text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>Credentials set</span>
                    <span className="font-semibold text-text-primary">{stat.connected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Enabled (live)</span>
                    <span className="font-semibold text-green-700">{stat.enabled}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active tokens</span>
                    <span className="font-semibold text-blue-700">{stat.activeTokens}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border-default bg-surface-primary p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">🔄 How mdw_omni_zdb_chat Works</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-text-secondary">
          <li>ลูกค้าพิมพ์ข้อความบน LINE / Facebook / Instagram / TikTok ของ brand</li>
          <li>Platform ส่ง webhook event มายัง <code className="text-xs bg-surface-secondary px-1 rounded">/api/webhooks/[platform]/[tenantId]</code></li>
          <li><strong>mdw_omni_zdb_chat</strong> ตรวจ signature, parse ข้อความ, สร้าง Context Token (TTL 15 นาที)</li>
          <li>สร้าง Deep Link → <code className="text-xs bg-surface-secondary px-1 rounded">brand.com?zudobot=1&ctx=TOKEN</code></li>
          <li>ส่ง link กลับไปหาลูกค้าทาง platform</li>
          <li>ลูกค้าคลิก → เปิดเว็บ brand → widget auto-open + inject ข้อความแรก</li>
        </ol>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, icon, color,
}: { label: string; value: number; icon: string; color: "brand"|"green"|"blue"|"purple" }) {
  const colorMap = {
    brand:  "text-brand-700  bg-brand-50",
    green:  "text-green-700  bg-green-50",
    blue:   "text-blue-700   bg-blue-50",
    purple: "text-purple-700 bg-purple-50",
  };
  return (
    <div className="rounded-xl border border-border-default bg-surface-primary p-4 flex items-center gap-3">
      <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg ${colorMap[color]}`}>
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold text-text-primary leading-none">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Tenants Tab ───────────────────────────────────────────────────────────────

function TenantsTab() {
  const [rows,    setRows]    = useState<TenantRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [pf,      setPf]      = useState("");
  const [loading, setLoad]    = useState(true);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoad(true);
    const p = new URLSearchParams({ tab: "tenants", page: String(page), limit: "20" });
    if (search) p.set("q", search);
    if (pf)     p.set("platform", pf);
    const res  = await fetch(`/api/admin/omni-chat?${p}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setLoad(false);
  }, [page, search, pf]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  async function togglePlatform(tenantId: string, platform: string, enabled: boolean) {
    const res = await fetch("/api/admin/omni-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, platform, enabled }),
    });
    if (res.ok) {
      setToast({ msg: `${platform} ${enabled ? "enabled" : "disabled"} สำเร็จ`, ok: true });
      void fetchRows();
    } else {
      setToast({ msg: "เกิดข้อผิดพลาด", ok: false });
    }
    setTimeout(() => setToast(null), 3000);
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหา tenant / domain…"
          className="px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
        />
        <select
          value={pf}
          onChange={(e) => { setPf(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">ทุก Platform</option>
          <option value="line">LINE OA</option>
          <option value="meta">Facebook / Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <span className="self-center text-xs text-text-muted">{total} tenants</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-default overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-secondary border-b border-border-default">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Tenant</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">LINE</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Meta</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">TikTok</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-primary">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-muted text-sm">กำลังโหลด…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-muted text-sm">ไม่พบข้อมูล</td></tr>
            ) : rows.map((row) => (
              <>
                <tr
                  key={row.tenantId}
                  className="hover:bg-surface-secondary/50 cursor-pointer"
                  onClick={() => setExpanded(expanded === row.tenantId ? null : row.tenantId)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary truncate max-w-[180px]">
                      {row.businessName || row.tenantId}
                    </p>
                    <p className="text-xs text-text-muted truncate max-w-[180px]">{row.email}</p>
                    <p className="text-xs text-text-muted truncate max-w-[180px]">{row.websiteUrl}</p>
                  </td>

                  {/* LINE */}
                  <td className="px-4 py-3">
                    <ChannelCell
                      platform="line"
                      connected={row.line.connected}
                      enabled={row.line.enabled}
                      onToggle={(v) => togglePlatform(row.tenantId, "line", v)}
                    />
                  </td>

                  {/* Meta */}
                  <td className="px-4 py-3">
                    <ChannelCell
                      platform="facebook"
                      connected={row.meta.connected}
                      enabled={row.meta.enabled}
                      onToggle={(v) => togglePlatform(row.tenantId, "facebook", v)}
                    />
                  </td>

                  {/* TikTok */}
                  <td className="px-4 py-3">
                    <ChannelCell
                      platform="tiktok"
                      connected={row.tiktok.connected}
                      enabled={row.tiktok.enabled}
                      onToggle={(v) => togglePlatform(row.tenantId, "tiktok", v)}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-text-muted">{expanded === row.tenantId ? "▲" : "▼"}</span>
                  </td>
                </tr>

                {/* Expanded detail row */}
                {expanded === row.tenantId && (
                  <tr key={`${row.tenantId}-detail`}>
                    <td colSpan={5} className="bg-surface-secondary/60 px-6 py-4">
                      <TenantDetail row={row} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors"
        >
          ← ก่อนหน้า
        </button>
        <span>หน้า {page} / {pages}</span>
        <button
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors"
        >
          ถัดไป →
        </button>
      </div>
    </div>
  );
}

function ChannelCell({
  platform, connected, enabled, onToggle,
}: {
  platform: PlatformName;
  connected: boolean;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-base">{meta.icon}</span>
      {connected ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!enabled); }}
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors
            ${enabled
              ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
              : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"}`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      ) : (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">—</span>
      )}
    </div>
  );
}

function TenantDetail({ row }: { row: TenantRow }) {
  const platforms: { key: PlatformName; label: string; detail: React.ReactNode }[] = [
    {
      key: "line",
      label: "LINE OA",
      detail: (
        <div className="space-y-1 text-xs text-text-secondary">
          <StatusPill ok={row.line.connected} label={row.line.connected ? "Secret set" : "No credentials"} />
          <StatusPill ok={row.line.hasToken}  label={row.line.hasToken  ? "Token set"  : "No channel token"} />
          {row.line.liffId && <div>LIFF ID: <code className="bg-white px-1 rounded text-[11px]">{row.line.liffId}</code></div>}
          {row.line.connected && (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-[10px] bg-white px-2 py-0.5 rounded border border-border-default truncate max-w-[280px]">
                {webhookUrl("line", row.tenantId)}
              </code>
              <CopyButton value={webhookUrl("line", row.tenantId)} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "facebook",
      label: "Facebook / Instagram",
      detail: (
        <div className="space-y-1 text-xs text-text-secondary">
          <StatusPill ok={row.meta.connected}  label={row.meta.connected  ? "App Secret set"      : "No credentials"} />
          <StatusPill ok={row.meta.hasToken}   label={row.meta.hasToken   ? "Page Token set"      : "No page token"} />
          <StatusPill ok={row.meta.verifySet}  label={row.meta.verifySet  ? "Verify Token set"    : "No verify token"} />
          {row.meta.pageId && <div>Page ID: <code className="bg-white px-1 rounded text-[11px]">{row.meta.pageId}</code></div>}
          {row.meta.connected && (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-[10px] bg-white px-2 py-0.5 rounded border border-border-default truncate max-w-[280px]">
                {webhookUrl("facebook", row.tenantId)}
              </code>
              <CopyButton value={webhookUrl("facebook", row.tenantId)} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tiktok",
      label: "TikTok",
      detail: (
        <div className="space-y-1 text-xs text-text-secondary">
          <StatusPill ok={row.tiktok.connected} label={row.tiktok.connected ? "Access Token set"   : "No credentials"} />
          <StatusPill ok={row.tiktok.hasSecret} label={row.tiktok.hasSecret ? "Webhook Secret set" : "No webhook secret"} />
          {row.tiktok.connected && (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-[10px] bg-white px-2 py-0.5 rounded border border-border-default truncate max-w-[280px]">
                {webhookUrl("tiktok", row.tenantId)}
              </code>
              <CopyButton value={webhookUrl("tiktok", row.tenantId)} />
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {platforms.map(({ key, label, detail }) => (
        <div key={key} className="bg-white rounded-lg border border-border-default p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span>{PLATFORM_META[key].icon}</span>
            <span className="text-xs font-semibold text-text-primary">{label}</span>
          </div>
          {detail}
        </div>
      ))}
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const [rows,    setRows]   = useState<ActivityRow[]>([]);
  const [total,   setTotal]  = useState(0);
  const [page,    setPage]   = useState(1);
  const [pf,      setPf]     = useState("");
  const [loading, setLoad]   = useState(true);
  const [tick,    setTick]   = useState(0);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoad(true);
    const p = new URLSearchParams({ tab: "activity", page: String(page), limit: "30" });
    if (pf) p.set("platform", pf);
    const res  = await fetch(`/api/admin/omni-chat?${p}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setLoad(false);
  }, [page, pf, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={pf}
          onChange={(e) => { setPf(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">ทุก Platform</option>
          <option value="line">LINE OA</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <span className="text-xs text-text-muted">{total} active tokens (auto-refresh 15s)</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-muted text-sm">กำลังโหลด…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🔗</p>
          <p className="text-sm text-text-muted">ไม่มี active deep-link tokens ขณะนี้</p>
          <p className="text-xs text-text-muted mt-1">Tokens จะแสดงเมื่อมีลูกค้าส่งข้อความผ่าน LINE / Facebook / Instagram / TikTok</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary border-b border-border-default">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">ลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">ข้อความ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">หมดอายุใน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-surface-primary">
              {rows.map((row, i) => {
                const pMeta = PLATFORM_META[row.platformName] ?? PLATFORM_META.line;
                const left  = timeLeft(row.expiresAt);
                const urgent = left !== "expired" && left.endsWith("s");
                return (
                  <tr key={i} className="hover:bg-surface-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary truncate max-w-[140px]">{row.businessName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${pMeta.bg} ${pMeta.color}`}>
                        {pMeta.icon} {pMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.displayName || <span className="italic text-text-muted">ไม่ระบุ</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary max-w-[200px]">
                      <span className="truncate block" title={row.initialMessage}>{row.initialMessage}</span>
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-mono font-semibold
                      ${urgent ? "text-orange-600" : "text-text-muted"}`}>
                      {left}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors"
          >
            ← ก่อนหน้า
          </button>
          <span>หน้า {page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary transition-colors"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Guides Tab ───────────────────────────────────────────────────────────────

function GuideStep({
  n, icon, title, children,
}: { n: number; icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
          {n}
        </div>
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

function GuideSection({
  icon, title, accent, children,
}: { icon: string; title: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border-default rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left ${accent}`}
      >
        <span className="text-2xl">{icon}</span>
        <span className="flex-1 font-bold text-base">{title}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && <div className="px-6 pt-5 pb-2 bg-surface-primary">{children}</div>}
    </div>
  );
}

function InfoBox({ color, children }: { color: "amber" | "blue" | "green"; children: React.ReactNode }) {
  const cls = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue:  "bg-blue-50  border-blue-200  text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
  }[color];
  return <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed my-3 ${cls}`}>{children}</div>;
}

function CodeSnip({ children }: { children: string }) {
  return (
    <code className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
      {children}
    </code>
  );
}

function GuidesTab() {
  return (
    <div className="space-y-5 max-w-3xl">

      {/* Intro */}
      <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 rounded-2xl px-5 py-4 space-y-2">
        <p className="text-sm font-bold text-brand-800">💡 ภาพรวมการทำงาน</p>
        <p className="text-xs text-brand-700">
          Tenant ตั้งค่า Webhook URL ของ Zudobot ไว้ใน Developer Console ของแต่ละ platform
          เมื่อลูกค้าส่งข้อความ → platform ยิง webhook มาที่ Zudobot →
          Zudobot สร้าง deep link ส่งกลับ → ลูกค้าคลิก → Widget เปิดบนเว็บ brand
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-brand-700 mt-1">
          {[
            "Webhook URL: /api/webhooks/line/[tenantId]",
            "Webhook URL: /api/webhooks/meta/[tenantId]",
            "Webhook URL: /api/webhooks/tiktok/[tenantId]",
          ].map((u) => (
            <span key={u} className="bg-white border border-brand-200 px-2 py-0.5 rounded-lg font-mono">{u}</span>
          ))}
        </div>
      </div>

      {/* LINE */}
      <GuideSection icon="💬" title="LINE Official Account — Messaging API" accent="bg-green-50 text-green-900">
        <InfoBox color="green">
          <strong>สิ่งที่ต้องมีก่อน:</strong> LINE Official Account (ต้องสมัครแยกที่ manager.line.biz) + บัญชี LINE personal
          สำหรับ login เข้า Developers Console
        </InfoBox>

        <div>
          <GuideStep n={1} icon="🌐" title="เข้า LINE Developers Console">
            <p>ไปที่ <strong>developers.line.biz</strong> → กด <strong>Log in</strong> ด้วย LINE account</p>
          </GuideStep>
          <GuideStep n={2} icon="📁" title="สร้าง Provider (ถ้ายังไม่มี)">
            <p>กด <strong>Create a new provider</strong> → ตั้งชื่อ (เช่น ชื่อบริษัท) → กด <strong>Create</strong></p>
          </GuideStep>
          <GuideStep n={3} icon="📱" title="สร้าง Messaging API Channel">
            <p>ใน Provider → กด <strong>Create a new channel</strong> → เลือก <strong>Messaging API</strong></p>
            <p>กรอก: Channel name, Description, Category, Subcategory → กด <strong>Create</strong></p>
            <p>ผูก LINE Official Account ที่มีอยู่ (หรือสร้างใหม่)</p>
          </GuideStep>
          <GuideStep n={4} icon="🔑" title="คัดลอก Channel Secret">
            <p>แท็บ <strong>Basic settings</strong> → เลื่อนหา <strong>Channel secret</strong></p>
            <p>กด <strong>Copy</strong> → นำไปวางใน Zudobot Dashboard → Channels → LINE</p>
            <InfoBox color="amber">⚠️ Channel secret ใช้ตรวจสอบ signature ของ webhook — ห้ามเผยแพร่</InfoBox>
          </GuideStep>
          <GuideStep n={5} icon="🎫" title="สร้าง Channel Access Token">
            <p>แท็บ <strong>Messaging API</strong> → เลื่อนหา <strong>Channel access token (long-lived)</strong></p>
            <p>กด <strong>Issue</strong> → คัดลอก token → วางใน Zudobot</p>
          </GuideStep>
          <GuideStep n={6} icon="🔗" title="ตั้งค่า Webhook URL">
            <p>แท็บ Messaging API → <strong>Webhook URL</strong> → กด <strong>Edit</strong></p>
            <p>วาง URL รูปแบบ: <CodeSnip>https://yourdomain.com/api/webhooks/line/[tenantId]</CodeSnip></p>
            <p>กด <strong>Verify</strong> (ต้องได้ Success) → toggle <strong>Use webhook: ON</strong></p>
            <InfoBox color="amber">
              ⚠️ ปิด &quot;Auto-reply messages&quot; และ &quot;Greeting messages&quot; ใน LINE Official Account Manager
              (manager.line.biz) ไม่งั้น LINE จะตอบซ้ำกับ Zudobot
            </InfoBox>
          </GuideStep>
          <GuideStep n={7} icon="✨" title="(แนะนำ) สร้าง LIFF App">
            <p>LIFF ทำให้ลูกค้าเปิดเว็บ brand ภายใน LINE app ได้โดยตรง — seamless กว่าเปิด external browser</p>
            <p>Provider → แท็บ <strong>LIFF</strong> → <strong>Add</strong></p>
            <p>Endpoint URL: URL เว็บ brand เช่น <CodeSnip>https://cafedoi.com</CodeSnip> → Size: <strong>Full</strong></p>
            <p>คัดลอก LIFF ID (หน้าตา: <CodeSnip>1234567890-xxxxxxxx</CodeSnip>) → ใส่ใน Zudobot</p>
          </GuideStep>
        </div>

        <InfoBox color="green">
          <strong>ทดสอบ:</strong> Scan QR Code ของ LINE OA → พิมพ์ข้อความใดก็ได้ → ควรได้รับ deep link กลับมา
        </InfoBox>
      </GuideSection>

      {/* Facebook */}
      <GuideSection icon="📘" title="Facebook Messenger" accent="bg-blue-50 text-blue-900">
        <InfoBox color="blue">
          <strong>วิธีที่แนะนำ:</strong> ใช้ปุ่ม &quot;เชื่อมต่อด้วย Facebook&quot; ใน Zudobot Dashboard — OAuth 1 คลิก
          Zudobot จัดการขอ token และบันทึกอัตโนมัติ ไม่ต้องทำขั้นตอนด้านล่างนี้
          <br/><br/>
          <strong>Manual (สำหรับ Advanced / Enterprise):</strong> ทำตามขั้นตอนด้านล่าง
        </InfoBox>

        <div>
          <GuideStep n={1} icon="🌐" title="สร้าง Meta App">
            <p>ไปที่ <strong>developers.facebook.com</strong> → <strong>My Apps</strong> → <strong>Create App</strong></p>
            <p>Use case: <strong>Other</strong> → App type: <strong>Business</strong> → กรอกชื่อ → Create</p>
          </GuideStep>
          <GuideStep n={2} icon="💬" title="เพิ่ม Messenger Product">
            <p>Dashboard → <strong>Add Product</strong> → <strong>Messenger</strong> → <strong>Set up</strong></p>
          </GuideStep>
          <GuideStep n={3} icon="🔗" title="ตั้งค่า Webhook">
            <p>Messenger settings → <strong>Webhooks</strong> → <strong>Add Callback URL</strong></p>
            <p>Callback URL: <CodeSnip>https://yourdomain.com/api/webhooks/meta/[tenantId]</CodeSnip></p>
            <p>Verify Token: ใส่ค่าเดียวกับที่แสดงใน Zudobot (ช่อง Verify Token)</p>
            <p>กด <strong>Verify and save</strong> → Subscribe: ✔ <strong>messages</strong>, ✔ <strong>messaging_postbacks</strong></p>
          </GuideStep>
          <GuideStep n={4} icon="🔑" title="Generate Page Access Token">
            <p>Messenger settings → <strong>Access Tokens</strong> → เลือก Facebook Page → กด <strong>Generate token</strong></p>
            <p>คัดลอก token → วางใน Zudobot (ช่อง Page Access Token)</p>
          </GuideStep>
          <GuideStep n={5} icon="🔒" title="คัดลอก App Secret">
            <p>App Dashboard → <strong>Settings → Basic</strong> → กด <strong>Show</strong> ข้าง App secret</p>
            <p>คัดลอก → วางใน Zudobot (ช่อง App Secret)</p>
          </GuideStep>
          <GuideStep n={6} icon="🚀" title="Submit App for Review (Production)">
            <p>ตอน development สามารถทดสอบได้กับ admin/developer ของ app เท่านั้น</p>
            <p>สำหรับ production: App Review → ขอ permission <strong>pages_messaging</strong></p>
            <InfoBox color="amber">⚠️ Meta App Review ใช้เวลา 1-5 วันทำการ ต้องมี Privacy Policy URL และ Business Verification</InfoBox>
          </GuideStep>
        </div>

        <InfoBox color="blue">
          <strong>ทดสอบ:</strong> ส่งข้อความไปที่ Facebook Page → ควรได้รับ deep link ตอบกลับภายใน 3 วินาที
        </InfoBox>
      </GuideSection>

      {/* Instagram */}
      <GuideSection icon="📸" title="Instagram (ใช้ร่วมกับ Facebook App)" accent="bg-pink-50 text-pink-900">
        <InfoBox color="blue">
          Instagram ใช้ Meta App เดียวกันกับ Facebook — ทำขั้นตอน Facebook ด้านบนก่อน แล้วเพิ่ม Instagram ต่อ
        </InfoBox>

        <div>
          <GuideStep n={1} icon="🔗" title="เชื่อม Instagram Business กับ Facebook Page">
            <p>Instagram app → Settings → Account type → Switch to <strong>Professional account</strong> (Business/Creator)</p>
            <p>Facebook Page → Settings → <strong>Linked accounts</strong> → เชื่อม Instagram</p>
          </GuideStep>
          <GuideStep n={2} icon="💬" title="เพิ่ม Instagram Messaging ใน Meta App">
            <p>Meta Developer → App → <strong>Add Product</strong> → <strong>Instagram</strong> → <strong>Set up</strong></p>
            <p>(หรือใน Messenger settings → แท็บ <strong>Instagram</strong>)</p>
          </GuideStep>
          <GuideStep n={3} icon="🔔" title="Subscribe Instagram Webhooks">
            <p>Webhooks → ใส่ Callback URL เดียวกับ Facebook: <CodeSnip>/api/webhooks/meta/[tenantId]</CodeSnip></p>
            <p>Subscribe: ✔ <strong>instagram_messages</strong></p>
          </GuideStep>
          <GuideStep n={4} icon="🔑" title="Page Access Token ครอบคลุม Instagram ด้วย">
            <p>Page Access Token เดิมที่ Generate แล้วจะ handle ทั้ง Messenger + Instagram โดยอัตโนมัติ</p>
            <p>ตรวจสอบว่า token มี scope: <CodeSnip>instagram_basic</CodeSnip> และ <CodeSnip>instagram_manage_messages</CodeSnip></p>
          </GuideStep>
        </div>

        <InfoBox color="blue">
          <strong>ทดสอบ:</strong> ส่ง DM ไปที่ Instagram Business account → ควรได้รับ deep link ตอบกลับ
        </InfoBox>
      </GuideSection>

      {/* TikTok */}
      <GuideSection icon="🎵" title="TikTok Direct Message" accent="bg-slate-50 text-slate-900">
        <InfoBox color="amber">
          <strong>⚠️ ข้อจำกัด:</strong> TikTok Direct Message API ต้องยื่นขอ permission และผ่าน review ก่อนใช้งาน production
          ได้ (ประมาณ 1-2 สัปดาห์) — ระหว่างรอสามารถทดสอบด้วย Sandbox mode
        </InfoBox>

        <div>
          <GuideStep n={1} icon="🌐" title="สมัคร TikTok for Developers">
            <p>ไปที่ <strong>developers.tiktok.com</strong> → <strong>Log in</strong></p>
            <p>กด <strong>Manage apps</strong> → <strong>Connect an app</strong> หรือ <strong>Create app</strong></p>
          </GuideStep>
          <GuideStep n={2} icon="✉️" title="ขอสิทธิ์ Direct Message API">
            <p>App settings → <strong>Products</strong> → ค้นหา <strong>Direct Message API</strong> → <strong>Add</strong></p>
            <p>กรอก Use case → Submit for review</p>
            <InfoBox color="amber">
              ระหว่าง review ใช้ <strong>Sandbox mode</strong> เพื่อทดสอบได้
              (เฉพาะ TikTok account ที่เพิ่มเป็น sandbox tester)
            </InfoBox>
          </GuideStep>
          <GuideStep n={3} icon="🔗" title="ตั้งค่า Webhook Endpoint">
            <p>App settings → <strong>Webhooks</strong> → <strong>Add endpoint</strong></p>
            <p>URL: <CodeSnip>https://yourdomain.com/api/webhooks/tiktok/[tenantId]</CodeSnip></p>
            <p>Events: ✔ <strong>direct_message.received</strong></p>
            <p>กด <strong>Save</strong> → TikTok จะส่ง verification request มา (Zudobot handle อัตโนมัติ)</p>
          </GuideStep>
          <GuideStep n={4} icon="🔑" title="คัดลอก Access Token">
            <p>App settings → <strong>Basic information</strong> → <strong>Access token</strong></p>
            <p>คัดลอก → วางใน Zudobot (ช่อง Access Token)</p>
          </GuideStep>
          <GuideStep n={5} icon="🔒" title="คัดลอก Webhook Secret">
            <p>App settings → <strong>Webhooks</strong> → กด <strong>Show secret</strong> → คัดลอก</p>
            <p>วางใน Zudobot (ช่อง Webhook Secret) — ใช้ตรวจสอบ signature</p>
          </GuideStep>
        </div>

        <InfoBox color="green">
          <strong>ทดสอบ (Sandbox):</strong> เพิ่ม TikTok account เป็น sandbox tester → ส่ง DM → ควรได้รับ deep link
        </InfoBox>
      </GuideSection>

      {/* Troubleshooting */}
      <div className="border border-border-default rounded-2xl p-5 bg-surface-primary space-y-3">
        <p className="text-sm font-bold text-text-primary">🛠 Troubleshooting ที่พบบ่อย</p>
        <div className="space-y-3 text-xs text-text-secondary">
          {[
            {
              q: "Webhook Verify ล้มเหลว",
              a: "ตรวจสอบว่า Zudobot deploy สำเร็จแล้ว และ tenantId ใน URL ถูกต้อง ลอง curl URL ก่อน",
            },
            {
              q: "ส่งข้อความแล้วไม่ได้รับ deep link",
              a: "เช็ค Admin → OmniChat → Live Activity ว่ามี token ถูกสร้างไหม ถ้าไม่มี = webhook ไม่ถึง Zudobot",
            },
            {
              q: "LINE ตอบซ้ำ (มีทั้ง Zudobot reply และ auto-reply)",
              a: "ปิด Auto-reply messages ใน LINE Official Account Manager (manager.line.biz)",
            },
            {
              q: "Facebook webhook 403",
              a: "App Secret ผิด หรือ Verify Token ไม่ตรงกับที่ตั้งค่าใน Zudobot",
            },
            {
              q: "Deep link เปิดแล้ว widget ไม่โผล่",
              a: "ตรวจสอบว่า Widget Script ติดตั้งบนเว็บ brand แล้ว และ ?zudobot=1&ctx=TOKEN ต่อท้าย URL ถูกต้อง",
            },
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

type Tab = "overview" | "tenants" | "activity" | "guides";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",  label: "ภาพรวม",           icon: "📊" },
  { id: "tenants",   label: "Tenant Channels",   icon: "👥" },
  { id: "activity",  label: "Live Activity",     icon: "🔗" },
  { id: "guides",    label: "คู่มือตั้งค่า",      icon: "📖" },
];

export default function AdminOmniChatPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <span className="text-2xl">📡</span>
          OmniChat — mdw_omni_zdb_chat
        </h1>
        <p className="text-sm text-text-muted mt-1">
          จัดการการเชื่อมต่อ LINE / Facebook Messenger / Instagram / TikTok → Zudobot Widget
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
      {activeTab === "overview"  && <OverviewTab />}
      {activeTab === "tenants"   && <TenantsTab />}
      {activeTab === "activity"  && <ActivityTab />}
      {activeTab === "guides"    && <GuidesTab />}
    </div>
  );
}
