"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RagStats {
  totalQueries:  number;
  atlasHits:     number;
  jsFallback:    number;
  misses:        number;
  hitRate:       number;
  avgTopScore:   number;
  avgDurationMs: number;
  days:          number;
}

interface RagEvent {
  _id:          string;
  tenantId:     string;
  sessionId:    string;
  querySnippet: string;
  method:       "atlas" | "js_fallback" | "miss";
  hitsCount:    number;
  topScore:     number;
  avgScore:     number;
  durationMs:   number;
  createdAt:    string;
}

interface ApiResponse {
  stats:  RagStats;
  total:  number;
  events: RagEvent[];
}

interface FewShotExample {
  _id:             string;
  userMessage:     string;
  botResponse:     string;
  tenantId:        string;
  engagementScore: number;
  extractedAt:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: RagEvent["method"] }) {
  const styles = {
    atlas:       "bg-emerald-100 text-emerald-800 border-emerald-200",
    js_fallback: "bg-amber-100  text-amber-800  border-amber-200",
    miss:        "bg-red-100    text-red-800    border-red-200",
  }[method];
  const labels = { atlas: "Atlas", js_fallback: "JS Fallback", miss: "Miss" };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${styles}`}>
      {labels[method]}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-white p-5 shadow-sm">
      <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${accent ?? "text-text-primary"}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

const PAGE_SIZE = 50;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RagAnalyticsPage() {
  const [data,       setData]       = useState<ApiResponse | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [days,       setDays]       = useState(7);
  const [method,     setMethod]     = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [offset,     setOffset]     = useState(0);

  // ── Self-learning extraction ─────────────────────────────────────────────────
  const [extracting,   setExtracting]   = useState(false);
  const [extractMsg,   setExtractMsg]   = useState<string | null>(null);
  const [examples,     setExamples]     = useState<FewShotExample[]>([]);
  const [examplesTotal, setExamplesTotal] = useState(0);
  const [loadingExamples, setLoadingExamples] = useState(false);

  // ── Schedule config ──────────────────────────────────────────────────────────
  interface ScheduleConfig {
    enabled: boolean; intervalHours: number; lookbackDays: number;
    maxPerRun: number; lastRunAt: string | null; nextRunAt: string | null;
    lastResult: { scanned: number; extracted: number; skipped: number; duplicate: number } | null;
  }
  const [schedCfg,      setSchedCfg]    = useState<ScheduleConfig | null>(null);
  const [savingCfg,     setSavingCfg]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days:   String(days),
        limit:  String(PAGE_SIZE),
        offset: String(offset),
      });
      if (method)       params.set("method",   method);
      if (tenantFilter) params.set("tenantId", tenantFilter);

      const res  = await fetch(`/api/admin/rag-events?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [days, method, tenantFilter, offset]);

  const fetchExamples = useCallback(async () => {
    setLoadingExamples(true);
    try {
      const res = await fetch("/api/admin/few-shot-extract?limit=50");
      if (!res.ok) return;
      const json = await res.json() as { total: number; examples: FewShotExample[] };
      setExamples(json.examples);
      setExamplesTotal(json.total);
    } finally {
      setLoadingExamples(false);
    }
  }, []);

  const triggerExtraction = async () => {
    setExtracting(true);
    setExtractMsg(null);
    try {
      const res = await fetch("/api/admin/few-shot-extract", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lookbackDays: 30, maxPerRun: 50 }),
      });
      const json = await res.json() as { ok: boolean; result: { scanned: number; extracted: number; skipped: number; duplicate: number } };
      const r = json.result;
      setExtractMsg(`✅ สแกน ${r.scanned} sessions → เพิ่มใหม่ ${r.extracted} | ข้ามซ้ำ ${r.duplicate} | ไม่ผ่าน ${r.skipped}`);
      void fetchExamples();
    } catch {
      setExtractMsg("❌ เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setExtracting(false);
    }
  };

  const deleteExample = async (id: string) => {
    await fetch(`/api/admin/few-shot-extract?id=${id}`, { method: "DELETE" });
    setExamples((prev) => prev.filter((e) => e._id !== id));
    setExamplesTotal((n) => n - 1);
  };

  const fetchScheduleCfg = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/self-learning-config");
      if (!res.ok) return;
      const json = await res.json() as { config: ScheduleConfig };
      setSchedCfg(json.config);
    } catch { /* non-critical */ }
  }, []);

  const saveScheduleCfg = async (patch: Partial<ScheduleConfig>) => {
    setSavingCfg(true);
    try {
      const res = await fetch("/api/admin/self-learning-config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json() as { config: ScheduleConfig };
      setSchedCfg(json.config);
    } finally { setSavingCfg(false); }
  };

  useEffect(() => { void fetchData(); void fetchExamples(); void fetchScheduleCfg(); }, [fetchData, fetchExamples, fetchScheduleCfg]);

  const s = data?.stats;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">RAG Analytics</h1>
          <p className="text-sm text-text-muted mt-0.5">
            ติดตามประสิทธิภาพ Knowledge Base — hit rate, top score, miss queries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void triggerExtraction()}
            disabled={extracting}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {extracting ? "⏳ กำลัง Extract..." : "🧠 Trigger Self-Learning"}
          </button>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "กำลังโหลด..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-border-default rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">ช่วงเวลา</label>
          <select
            value={days}
            onChange={e => { setDays(Number(e.target.value)); setOffset(0); }}
            className="text-sm border border-border-default rounded-lg px-2 py-1"
          >
            <option value={1}>1 วัน</option>
            <option value={3}>3 วัน</option>
            <option value={7}>7 วัน</option>
            <option value={14}>14 วัน</option>
            <option value={30}>30 วัน</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">Method</label>
          <select
            value={method}
            onChange={e => { setMethod(e.target.value); setOffset(0); }}
            className="text-sm border border-border-default rounded-lg px-2 py-1"
          >
            <option value="">ทั้งหมด</option>
            <option value="atlas">Atlas</option>
            <option value="js_fallback">JS Fallback</option>
            <option value="miss">Miss เท่านั้น</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Tenant ID..."
          value={tenantFilter}
          onChange={e => { setTenantFilter(e.target.value); setOffset(0); }}
          className="text-sm border border-border-default rounded-lg px-3 py-1 w-48"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard
            label="Hit Rate"
            value={`${s.hitRate}%`}
            sub={`${s.days} วันล่าสุด`}
            accent={s.hitRate >= 70 ? "text-emerald-600" : s.hitRate >= 40 ? "text-amber-600" : "text-red-600"}
          />
          <StatCard label="คำถามทั้งหมด" value={s.totalQueries.toLocaleString("th-TH")} />
          <StatCard label="Atlas Hits" value={s.atlasHits.toLocaleString("th-TH")} accent="text-emerald-600" />
          <StatCard label="JS Fallback" value={s.jsFallback.toLocaleString("th-TH")} accent="text-amber-600" />
          <StatCard
            label="Miss (ไม่พบ KB)"
            value={s.misses.toLocaleString("th-TH")}
            accent={s.misses > 0 ? "text-red-600" : "text-text-primary"}
          />
          <StatCard
            label="Avg Top Score"
            value={(s.avgTopScore * 100).toFixed(1) + "%"}
            accent={s.avgTopScore >= 0.7 ? "text-emerald-600" : s.avgTopScore >= 0.4 ? "text-amber-600" : "text-red-600"}
          />
          <StatCard label="Avg Duration" value={`${s.avgDurationMs} ms`} />
        </div>
      )}

      {/* Schedule config */}
      {schedCfg && (
        <div className="rounded-xl border border-border-default bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">⏰ Auto Self-Learning Schedule</p>
              <p className="text-xs text-text-muted mt-0.5">
                ระบบจะ extract few-shot examples อัตโนมัติตามรอบที่กำหนด
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-text-secondary">เปิดใช้งาน</span>
              <button
                type="button"
                onClick={() => void saveScheduleCfg({ enabled: !schedCfg.enabled })}
                disabled={savingCfg}
                className={`relative w-10 h-6 rounded-full transition-colors ${schedCfg.enabled ? "bg-emerald-500" : "bg-zinc-300"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${schedCfg.enabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Interval */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">รันทุกๆ (ชั่วโมง)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={1} max={24} step={1}
                  value={schedCfg.intervalHours}
                  onChange={(e) => setSchedCfg({ ...schedCfg, intervalHours: Number(e.target.value) })}
                  onMouseUp={(e) => void saveScheduleCfg({ intervalHours: Number((e.target as HTMLInputElement).value) })}
                  className="flex-1 accent-brand-600"
                />
                <span className="text-sm font-bold text-brand-600 w-8 text-center">
                  {schedCfg.intervalHours}h
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {schedCfg.intervalHours <= 4 ? "⚡ บ่อยมาก (High traffic)" :
                 schedCfg.intervalHours <= 8 ? "✅ แนะนำ — Balance ดี" :
                 schedCfg.intervalHours <= 12 ? "🟡 ปานกลาง" : "🔵 ประหยัด"}
              </p>
            </div>

            {/* Lookback */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">สแกนย้อนหลัง (วัน)</label>
              <select
                value={schedCfg.lookbackDays}
                onChange={(e) => void saveScheduleCfg({ lookbackDays: Number(e.target.value) })}
                className="w-full text-sm border border-border-default rounded-lg px-2 py-1.5"
              >
                {[7, 14, 30].map((d) => <option key={d} value={d}>{d} วัน</option>)}
              </select>
            </div>

            {/* Max per run */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Max examples/รัน</label>
              <select
                value={schedCfg.maxPerRun}
                onChange={(e) => void saveScheduleCfg({ maxPerRun: Number(e.target.value) })}
                className="w-full text-sm border border-border-default rounded-lg px-2 py-1.5"
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Status row */}
          <div className="flex flex-wrap gap-4 text-xs text-text-muted pt-1 border-t border-border-default">
            <span>รันล่าสุด: <strong className="text-text-primary">
              {schedCfg.lastRunAt ? new Date(schedCfg.lastRunAt).toLocaleString("th-TH") : "ยังไม่เคยรัน"}
            </strong></span>
            <span>รันถัดไป: <strong className={schedCfg.enabled ? "text-emerald-700" : "text-text-muted"}>
              {schedCfg.nextRunAt && schedCfg.enabled ? new Date(schedCfg.nextRunAt).toLocaleString("th-TH") : "—"}
            </strong></span>
            {schedCfg.lastResult && (
              <span>ผลล่าสุด: เพิ่ม <strong className="text-emerald-700">{schedCfg.lastResult.extracted}</strong> · ซ้ำ {schedCfg.lastResult.duplicate} · ไม่ผ่าน {schedCfg.lastResult.skipped}</span>
            )}
          </div>
        </div>
      )}

      {/* Events table */}
      <div className="rounded-xl border border-border-default bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">
            Event Log{data ? ` — ${data.total.toLocaleString("th-TH")} รายการ` : ""}
          </p>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center gap-2 text-sm">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
              >
                ← ก่อนหน้า
              </button>
              <span className="text-text-muted">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} / {data.total}
              </span>
              <button
                disabled={offset + PAGE_SIZE >= data.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="px-3 py-1 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
              >
                ถัดไป →
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-xs text-text-muted uppercase">
              <tr>
                <th className="px-4 py-2 text-left">เวลา</th>
                <th className="px-4 py-2 text-left">Tenant</th>
                <th className="px-4 py-2 text-left">Query</th>
                <th className="px-4 py-2 text-center">Method</th>
                <th className="px-4 py-2 text-center">Hits</th>
                <th className="px-4 py-2 text-center">Top Score</th>
                <th className="px-4 py-2 text-center">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-muted">กำลังโหลด...</td>
                </tr>
              )}
              {!loading && data?.events.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-muted">ยังไม่มีข้อมูล</td>
                </tr>
              )}
              {data?.events.map(ev => (
                <tr
                  key={ev._id}
                  className={`hover:bg-surface-secondary/50 transition-colors ${
                    ev.method === "miss" ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap text-xs">
                    {new Date(ev.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-text-muted max-w-[120px] truncate">
                    {ev.tenantId}
                  </td>
                  <td className="px-4 py-2 max-w-[260px] truncate text-text-primary">
                    {ev.querySnippet || <span className="text-text-muted italic">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <MethodBadge method={ev.method} />
                  </td>
                  <td className="px-4 py-2 text-center font-semibold">
                    {ev.hitsCount}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={
                      ev.topScore >= 0.7 ? "text-emerald-600 font-semibold" :
                      ev.topScore >= 0.4 ? "text-amber-600 font-semibold" :
                      ev.topScore > 0    ? "text-red-600" :
                      "text-text-muted"
                    }>
                      {ev.topScore > 0 ? `${(ev.topScore * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-text-muted text-xs">
                    {ev.durationMs} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extraction result message */}
      {extractMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          extractMsg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {extractMsg}
        </div>
      )}

      {/* Few-shot examples */}
      <div className="rounded-xl border border-border-default bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              🧠 Self-Learning Examples{examplesTotal > 0 ? ` — ${examplesTotal} รายการ` : ""}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Q&A ที่ bot เรียนรู้จาก conversation history จริง — inject เข้า system prompt อัตโนมัติ
            </p>
          </div>
          <button
            onClick={() => void fetchExamples()}
            disabled={loadingExamples}
            className="text-xs text-brand-600 hover:underline disabled:opacity-40"
          >
            Reload
          </button>
        </div>

        {loadingExamples && examples.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">กำลังโหลด...</p>
        )}

        {!loadingExamples && examples.length === 0 && (
          <div className="py-10 text-center space-y-2">
            <p className="text-text-muted text-sm">ยังไม่มี examples — กด <strong>🧠 Trigger Self-Learning</strong> เพื่อเริ่ม extract</p>
            <p className="text-xs text-text-muted">ระบบจะสแกน conversation history ย้อนหลัง 30 วัน และเลือก Q&A ที่ลูกค้าตอบรับดีมาใช้</p>
          </div>
        )}

        {examples.length > 0 && (
          <div className="divide-y divide-border-default">
            {examples.map((ex) => (
              <div key={ex._id} className="px-5 py-3 flex items-start gap-4 hover:bg-surface-secondary/40">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium text-text-muted mr-1">ลูกค้า:</span>
                    <span className="text-text-primary">{ex.userMessage}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-text-muted mr-1">ผู้ช่วย:</span>
                    <span className="text-emerald-700">{ex.botResponse}</span>
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-text-muted">score: {ex.engagementScore}</span>
                  <button
                    onClick={() => void deleteExample(ex._id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
