"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trash2, RefreshCw, Globe, AlertCircle, CheckCircle,
  FileText, Plus, X, Link2, FileUp, Loader2,
} from "lucide-react";

interface KnowledgeSource {
  url:             string;
  chunkCount:      number;
  lastSyncAt:      string;
  status:          "pending" | "processing" | "done" | "failed";
  totalChunks?:    number;
  processedChunks?: number;
  errorMsg?:       string;
}

// ── helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function domainToUrl(domain: string): string {
  return `https://${domain.replace(/^www\./, "")}`;
}

type SourceKind = "url" | "custom" | "file";

function sourceKind(url: string): SourceKind {
  if (url.startsWith("custom::")) return "custom";
  if (url.startsWith("file::"))   return "file";
  return "url";
}

function sourceLabel(url: string): string {
  if (url.startsWith("custom::")) return url.slice(8);
  if (url.startsWith("file::"))   return url.slice(6);
  return url;
}

function fmtBytes(n: number): string {
  if (n < 1_024)     return `${n} B`;
  if (n < 1_048_576) return `${(n / 1_024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fileNameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

async function safeJson(res: Response): Promise<{ ok: boolean; error?: string; [k: string]: unknown } | null> {
  try {
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── File validation ───────────────────────────────────────────────

const ALLOWED_EXTS    = [".pdf", ".txt", ".docx"];
const MAX_FILES       = 5;
const MAX_TOTAL_MB    = 5;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;

// ── Progress bar ──────────────────────────────────────────────────

function ProgressBar({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div className="w-full mt-1.5">
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-text-muted mt-0.5">
        {processed} / {total} chunks ({pct}%)
      </p>
    </div>
  );
}

// ── Add Knowledge Modal ───────────────────────────────────────────

function AddKnowledgeModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [tab,            setTab]            = useState<"text" | "file">("text");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");

  const [files,    setFiles]    = useState<File[]>([]);
  const [fileErr,  setFileErr]  = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  function addFiles(incoming: FileList | File[]) {
    const arr      = Array.from(incoming);
    const combined = [...files, ...arr];

    const badExt = arr.filter((f) => {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      return !ALLOWED_EXTS.includes(ext);
    });
    if (badExt.length > 0) {
      setFileErr(`ไม่รองรับ: ${badExt.map((f) => f.name).join(", ")} (รองรับเฉพาะ PDF, TXT, DOCX)`);
      return;
    }
    if (combined.length > MAX_FILES) { setFileErr(`เลือกได้สูงสุด ${MAX_FILES} ไฟล์`); return; }
    const newTotal = combined.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_TOTAL_BYTES) {
      setFileErr(`ขนาดรวมเกิน ${MAX_TOTAL_MB} MB (${fmtBytes(newTotal)}) — กรุณาลดขนาดหรือจำนวนไฟล์`);
      return;
    }
    setFileErr(null);
    setFiles(combined);
  }

  function removeFile(idx: number) { setFiles((p) => p.filter((_, i) => i !== idx)); setFileErr(null); }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }
  function switchTab(t: "text" | "file") { setTab(t); setError(null); setFileErr(null); }

  const UPLOAD_ERRS: Record<string, string> = {
    file_too_large:    "ไฟล์ใหญ่เกินไป (สูงสุด 4 MB ต่อไฟล์)",
    unsupported_type:  "ประเภทไฟล์ไม่รองรับ",
    parse_failed:      "อ่านไฟล์ไม่ได้ — ลองแปลงเป็น TXT ก่อน",
    content_too_short: "เนื้อหาในไฟล์น้อยเกินไป",
    quota_exceeded:    "ถึง limit แล้ว กรุณาลบ source เก่าก่อน",
  };

  const TEXT_ERRS: Record<string, string> = {
    title_required:    "กรุณาใส่ชื่อ",
    content_required:  "กรุณาใส่เนื้อหา",
    content_too_short: "เนื้อหาน้อยเกินไป (ต้องมากกว่า 50 ตัวอักษร)",
    content_too_long:  "เนื้อหายาวเกินไป (สูงสุด 150,000 ตัวอักษร)",
    quota_exceeded:    "ถึง limit แล้ว กรุณาลบ source เก่าก่อน",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      if (tab === "file") {
        if (files.length === 0 || fileErr) { setSaving(false); return; }

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setUploadProgress(`กำลังอัปโหลด ${i + 1}/${files.length}: ${f.name}`);

          const fd = new FormData();
          fd.append("file",  f);
          fd.append("title", fileNameWithoutExt(f.name));

          let res: Response;
          try { res = await fetch("/api/tenant/knowledge/upload", { method: "POST", body: fd }); }
          catch {
            setError(`${f.name}: เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่`);
            setUploadProgress(null);
            return;
          }

          const data = await safeJson(res);
          if (!data) {
            setError(`${f.name}: server ตอบกลับไม่ถูกต้อง (${res.status}) — กรุณาลองใหม่`);
            setUploadProgress(null);
            return;
          }
          if (!data.ok) {
            setError(`${f.name}: ${UPLOAD_ERRS[data.error ?? ""] ?? `Error: ${data.error}`}`);
            setUploadProgress(null);
            return;
          }
        }

        setUploadProgress(null);
        onSuccess();
        onClose();

      } else {
        let res: Response;
        try {
          res = await fetch("/api/tenant/knowledge/custom", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ title: title.trim(), content: content.trim() }),
          });
        } catch {
          setError("เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่");
          return;
        }

        const data = await safeJson(res);
        if (!data) {
          setError(`server ตอบกลับไม่ถูกต้อง (${res.status}) — กรุณาลองใหม่`);
        } else if (data.ok) {
          onSuccess();
          onClose();
        } else {
          setError(TEXT_ERRS[data.error ?? ""] ?? `Error: ${data.error}`);
        }
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  const canSubmit = tab === "text"
    ? !saving && !!title.trim() && !!content.trim()
    : !saving && files.length > 0 && !fileErr;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-border-default flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default flex-shrink-0">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-text-primary">Add Custom Knowledge</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-secondary transition-colors">
            <X size={15} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">

            <div className="flex bg-surface-secondary rounded-xl p-1 gap-1">
              {(["text", "file"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={[
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                    tab === t ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary",
                  ].join(" ")}
                >
                  {t === "text" ? <><FileText size={13} />ข้อความ</> : <><FileUp size={13} />อัปโหลดไฟล์</>}
                </button>
              ))}
            </div>

            {tab === "text" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">ชื่อ / Label</label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น ตารางราคา, FAQ, นโยบายคืนสินค้า"
                    maxLength={100} disabled={saving}
                    className="w-full border border-border-default rounded-xl px-3.5 py-2 text-sm bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    เนื้อหา{" "}
                    <span className="text-text-muted font-normal">({content.length.toLocaleString()} / 150,000)</span>
                  </label>
                  <textarea
                    value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder={"วางข้อมูลดิบที่ต้องการให้บอทรู้ เช่น:\n\nแพ็กเกจ Basic — 299 บาท/เดือน\nแพ็กเกจ Pro — 799 บาท/เดือน\n\nหรือ FAQ, ข้อมูลสินค้า, ข้อความใดๆ ก็ได้"}
                    maxLength={150_000} disabled={saving} rows={9}
                    className="w-full border border-border-default rounded-xl px-3.5 py-2.5 text-sm bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 disabled:opacity-50 resize-y font-mono leading-relaxed"
                  />
                  <p className="text-[11px] text-text-muted mt-1.5">
                    ข้อความจะถูกบันทึกทันที แล้ว embed เป็น chunks ในพื้นหลัง
                  </p>
                </div>
              </>
            )}

            {tab === "file" && (
              <div className="space-y-3">
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" multiple onChange={handleFileInput} className="hidden" />

                <div
                  onClick={() => !saving && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); if (!saving) setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={[
                    "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-6 transition-colors",
                    saving ? "opacity-50 cursor-not-allowed border-border-default"
                      : dragOver ? "border-brand-400 bg-brand-50 cursor-pointer"
                      : "border-border-default hover:border-brand-300 hover:bg-surface-secondary cursor-pointer",
                  ].join(" ")}
                >
                  <div className={["w-11 h-11 rounded-2xl flex items-center justify-center transition-colors", dragOver ? "bg-brand-100" : "bg-surface-secondary"].join(" ")}>
                    <FileUp size={20} className={dragOver ? "text-brand-600" : "text-text-muted"} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก</p>
                    <p className="text-xs text-text-muted mt-0.5">PDF · TXT · DOCX · สูงสุด {MAX_FILES} ไฟล์ · รวมไม่เกิน {MAX_TOTAL_MB} MB</p>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-secondary rounded-xl border border-border-default">
                        <FileUp size={14} className="text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{f.name}</p>
                          <p className="text-xs text-text-muted">{fmtBytes(f.size)}</p>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} disabled={saving} className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-text-muted transition-colors disabled:opacity-40">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-text-muted">{files.length} ไฟล์</span>
                      <span className={["text-xs font-medium", totalBytes > MAX_TOTAL_BYTES ? "text-red-500" : "text-text-muted"].join(" ")}>
                        รวม {fmtBytes(totalBytes)} / {MAX_TOTAL_MB} MB
                      </span>
                    </div>
                  </div>
                )}

                {fileErr && (
                  <div className="flex items-start gap-2 text-xs rounded-xl px-3.5 py-2.5 bg-red-50 text-red-600 border border-red-200">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{fileErr}
                  </div>
                )}

                <p className="text-[11px] text-text-muted">
                  ไฟล์จะถูก Extract ข้อความทันที แล้ว Embed เป็น chunks ในพื้นหลัง — สามารถปิด modal ได้หลังกดบันทึก
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs rounded-xl px-3.5 py-2.5 bg-red-50 text-red-600 border border-red-200">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
              </div>
            )}

            {uploadProgress && (
              <div className="flex items-center gap-2 text-xs text-brand-600 animate-pulse">
                <Loader2 size={13} className="animate-spin flex-shrink-0" />{uploadProgress}
              </div>
            )}

            {saving && !uploadProgress && (
              <p className="text-xs text-text-muted animate-pulse">กำลังบันทึก...</p>
            )}
          </div>

          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border-default flex-shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50">
              ยกเลิก
            </button>
            <button
              type="submit" disabled={!canSubmit}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? "กำลังบันทึก..." : tab === "file" && files.length > 1 ? `บันทึก ${files.length} ไฟล์` : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Source status badge ───────────────────────────────────────────

function StatusBadge({ source }: { source: KnowledgeSource }) {
  if (source.status === "done" || !source.status) return null;

  if (source.status === "failed") {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
        failed
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
      <Loader2 size={9} className="animate-spin" />
      {source.status === "pending" ? "pending" : "processing"}
    </span>
  );
}

// ── Auto-refresh schedule card ────────────────────────────────────

interface RefreshSchedule {
  enabled:       boolean;
  intervalHours: number;
  status:        "idle" | "running";
  lastRunAt:     string | null;
  nextRunAt:     string | null;
  lastResult: {
    urlsRefetched:    number;
    chunksReembedded: number;
    sourcesCompleted: number;
    failed:           number;
    finishedAt?:      string;
  } | null;
  presets: number[];
}

const INTERVAL_LABELS: Record<number, string> = {
  2:   "ทุก 2 ชั่วโมง",
  6:   "ทุก 6 ชั่วโมง",
  12:  "ทุก 12 ชั่วโมง",
  24:  "ทุกวัน (24 ชม.)",
  48:  "ทุก 2 วัน",
  168: "ทุกสัปดาห์",
};

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "เร็ว ๆ นี้";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `อีก ${mins} นาที`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `อีก ${hrs} ชั่วโมง`;
  return `อีก ${Math.round(hrs / 24)} วัน`;
}

function AutoRefreshCard() {
  const [sched,  setSched]  = useState<RefreshSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/tenant/knowledge/refresh-schedule");
        const data = await safeJson(res);
        if (data?.ok) setSched(data.schedule as RefreshSchedule);
      } catch { /* ignore */ }
    })();
  }, []);

  const save = useCallback(async (patch: { enabled?: boolean; intervalHours?: number }) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/knowledge/refresh-schedule", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      const data = await safeJson(res);
      if (data?.ok) {
        setSched(data.schedule as RefreshSchedule);
        setMsg({ type: "ok", text: "บันทึกการตั้งค่าแล้ว" });
      } else {
        setMsg({ type: "err", text: "บันทึกไม่สำเร็จ กรุณาลองใหม่" });
      }
    } catch {
      setMsg({ type: "err", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setSaving(false);
    }
  }, []);

  if (!sched) return null;

  const presets = sched.presets?.length ? sched.presets : [2, 6, 12, 24, 48, 168];

  return (
    <div className="border border-border-default rounded-2xl p-4 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">⏱️ Refresh อัตโนมัติ</p>
          <p className="text-xs text-text-muted mt-0.5">
            ให้ระบบดึงเนื้อหาเว็บใหม่ (re-fetch) และ re-embed ข้อมูลใน Knowledge Base ตามเวลาที่กำหนด — บอทจะอ่านข้อมูลล่าสุดเสมอ
          </p>
        </div>
        {/* Enable toggle */}
        <button
          role="switch"
          aria-checked={sched.enabled}
          disabled={saving}
          onClick={() => void save({ enabled: !sched.enabled })}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
            sched.enabled ? "bg-brand-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              sched.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Interval selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted">ความถี่:</label>
        <select
          value={sched.intervalHours}
          disabled={!sched.enabled || saving}
          onChange={(e) => void save({ intervalHours: Number(e.target.value) })}
          className="text-sm border border-border-default rounded-lg px-2.5 py-1.5 bg-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {presets.map((h) => (
            <option key={h} value={h}>{INTERVAL_LABELS[h] ?? `ทุก ${h} ชม.`}</option>
          ))}
        </select>
        {sched.status === "running" && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
            <Loader2 size={9} className="animate-spin" />
            กำลังทำงาน
          </span>
        )}
      </div>

      {/* Status line */}
      {sched.enabled && (
        <div className="text-[11px] text-text-muted space-y-0.5">
          {sched.lastRunAt && <p>รอบล่าสุด: {timeAgo(sched.lastRunAt)}</p>}
          {sched.nextRunAt && sched.status !== "running" && <p>รอบถัดไป: {timeUntil(sched.nextRunAt)}</p>}
          {sched.lastResult && (
            <p>
              ผลล่าสุด: ดึงเว็บใหม่ {sched.lastResult.urlsRefetched} · re-embed {sched.lastResult.chunksReembedded} chunks · เสร็จ {sched.lastResult.sourcesCompleted} sources
              {sched.lastResult.failed > 0 ? ` · พลาด ${sched.lastResult.failed}` : ""}
            </p>
          )}
        </div>
      )}

      {msg && (
        <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 ${
          msg.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [sources,        setSources]        = useState<KnowledgeSource[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [autoSyncStatus, setAutoSyncStatus] = useState<string | null>(null);
  const [url,            setUrl]            = useState("");
  const [urlWarning,     setUrlWarning]     = useState<string | null>(null);
  const [syncing,        setSyncing]        = useState(false);
  const [syncMsg,        setSyncMsg]        = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [deletingUrl,    setDeletingUrl]    = useState<string | null>(null);
  const [showModal,      setShowModal]      = useState(false);
  const [reembedding,   setReembedding]    = useState(false);
  const [reembedMsg,    setReembedMsg]     = useState<{ type: "ok"|"err"; text: string } | null>(null);

  // Tracks the latest sources without stale-closure issues in callbacks
  const sourcesRef      = useRef<KnowledgeSource[]>([]);
  // Guard: prevents concurrent driveProcessing loops
  const isProcessingRef = useRef(false);
  // Halt polling when embed failures are non-retryable (auth / model config)
  const haltProcessingRef = useRef(false);

  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  const fetchSources = useCallback(async (): Promise<KnowledgeSource[]> => {
    try {
      const res  = await fetch("/api/tenant/knowledge");
      const data = await res.json();
      const list: KnowledgeSource[] = data.sources ?? [];
      setSources(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  function shouldHaltProcessing(errorCode?: string, isRetryable?: boolean): boolean {
    if (
      errorCode === "gemini_auth_failed" ||
      errorCode === "gemini_model_not_found" ||
      errorCode === "gemini_not_configured"
    ) {
      return true;
    }
    return isRetryable === false;
  }

  // Drives background embedding: fires /process for every active source in a loop,
  // refreshing state after each round. Guarded so only one loop runs at a time.
  const driveProcessing = useCallback(async () => {
    if (isProcessingRef.current || haltProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (haltProcessingRef.current) break;

        const active = sourcesRef.current.filter(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (active.length === 0) break;

        const outcomes = await Promise.allSettled(
          active.map(async (s) => {
            const res = await fetch("/api/tenant/knowledge/process", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ sourceUrl: s.url }),
            });
            return res.json() as Promise<{
              ok?: boolean;
              status?: string;
              error?: string;
              userMessage?: string;
              isRetryable?: boolean;
            }>;
          }),
        );

        for (const outcome of outcomes) {
          if (outcome.status !== "fulfilled") continue;
          const data = outcome.value;
          if (!data.ok && data.status === "failed") {
            setSyncMsg({
              type: "err",
              text: data.userMessage ?? "การแปลงรหัสความรู้ล้มเหลว",
            });
            if (shouldHaltProcessing(data.error, data.isRetryable)) {
              haltProcessingRef.current = true;
              console.warn(
                "[POLLING_HALTED] Stopped processing loop due to non-retryable error:",
                data.error,
              );
            }
          }
        }

        if (haltProcessingRef.current) break;

        const updated = await fetchSources();
        const remaining = updated.filter(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (remaining.length === 0) break;

        await new Promise<void>((r) => setTimeout(r, 3_000));
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [fetchSources]);

  // Heartbeat: safety net that restarts driveProcessing if it somehow wasn't triggered
  // (e.g. page load found pending jobs, or first fetchSources raced with job creation)
  useEffect(() => {
    const hb = setInterval(() => {
      if (haltProcessingRef.current) return;
      const active = sourcesRef.current.filter(
        (s) => s.status === "pending" || s.status === "processing",
      );
      if (active.length > 0 && !isProcessingRef.current) {
        driveProcessing();
      }
    }, 5_000);
    return () => clearInterval(hb);
  }, [driveProcessing]);

  useEffect(() => {
    async function init() {
      try {
        const [existingSources, profileRes] = await Promise.all([
          fetchSources(),
          fetch("/api/tenant/me"),
        ]);
        const profileData     = await profileRes.json();
        const allowedDomains: string[] = profileData.profile?.allowedDomains ?? [];
        const syncedUrls      = new Set(existingSources.map((s: KnowledgeSource) => s.url));
        const unsyncedDomains = allowedDomains.filter((d) => !syncedUrls.has(domainToUrl(d)));

        if (unsyncedDomains.length > 0) {
          for (let i = 0; i < unsyncedDomains.length; i++) {
            setAutoSyncStatus(`กำลัง sync อัตโนมัติ ${i + 1}/${unsyncedDomains.length}: ${unsyncedDomains[i]}`);
            try {
              await fetch("/api/tenant/knowledge/sync", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ url: domainToUrl(unsyncedDomains[i]) }),
              });
            } catch { /* ignore */ }
          }
          setAutoSyncStatus(null);
          await fetchSources();
        }
        // driveProcessing picks up any pending/processing jobs (new or from previous session)
        driveProcessing();
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchSources, driveProcessing]);

  // Login-required platforms — must match server-side list in scraper.ts
  const LOGIN_REQUIRED_HOSTS = [
    "facebook.com", "fb.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "tiktok.com",
    "line.me", "liff.line.me",
    "mail.google.com", "docs.google.com", "drive.google.com",
    "dropbox.com", "notion.so",
  ];

  function checkUrlWarning(raw: string): string | null {
    if (!raw.trim()) return null;
    try {
      const { hostname } = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
      const clean = hostname.replace(/^www\./, "").toLowerCase();
      if (LOGIN_REQUIRED_HOSTS.some((h) => clean === h || clean.endsWith(`.${h}`))) {
        return `⚠️ ${hostname} ต้องการการล็อกอิน — ระบบไม่สามารถดึงข้อมูลได้ เนื่องจากการเข้าถึงต้องใช้ข้อมูลส่วนตัว กรุณาคัดลอกเนื้อหาที่ต้องการมาเพิ่มเป็น "ข้อความ" แทน`;
      }
    } catch { /* ignore */ }
    return null;
  }

  const handleSync = async () => {
    if (!url.trim() || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch("/api/tenant/knowledge/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        haltProcessingRef.current = false;
        setSyncMsg({ type: "ok", text: `Scrape สำเร็จ — กำลัง embed ${data.totalChunks} chunks ในพื้นหลัง` });
        setUrl("");
        await fetchSources();
        driveProcessing();
      } else {
        const msgs: Record<string, string> = {
          url_required:      "กรุณาใส่ URL",
          invalid_url:       "URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)",
          login_required:    `⚠️ ${data.hostname ?? "เว็บไซต์นี้"} ต้องการการล็อกอินเพื่อเข้าถึงข้อมูล — ระบบไม่สามารถดึงข้อมูลได้ เนื่องจากการเข้าถึงต้องใช้ข้อมูลส่วนตัวซึ่งเป็นความลับ กรุณาคัดลอกเนื้อหาที่ต้องการมาเพิ่มเป็น "ข้อความ" แทน`,
          scrape_failed:     `ดึงข้อมูลไม่ได้: ${data.detail ?? ""}`,
          content_too_short: "เนื้อหาน้อยเกินไป — ลองใส่ URL หน้าที่มีเนื้อหามากกว่านี้",
          rate_limited:      `รอก่อน — ลองใหม่ใน ${data.retryAfterSeconds} วินาที`,
          quota_exceeded:    "ถึง limit 1,000 chunks แล้ว กรุณาลบ URL เก่าออกก่อน",
        };
        setSyncMsg({ type: "err", text: msgs[data.error] ?? `Error: ${data.error}` });
      }
    } catch {
      setSyncMsg({ type: "err", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (sourceUrl: string) => {
    setDeletingUrl(sourceUrl);
    try {
      await fetch("/api/tenant/knowledge", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: sourceUrl }),
      });
      await fetchSources();
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleReembed = async (sourceUrl?: string) => {
    setReembedding(true);
    setReembedMsg(null);
    let totalReembedded = 0;
    let totalFailed     = 0;
    let offset          = 0;
    try {
      // Loop with offset pagination — each call processes next 80 chunks
      while (true) {
        const body: Record<string, unknown> = { offset };
        if (sourceUrl) body.sourceUrl = sourceUrl;
        const res  = await fetch("/api/tenant/knowledge/reembed", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        });
        const data = await res.json() as { ok: boolean; reembedded?: number; failed?: number; processed?: number; total?: number; remaining?: number; message?: string };
        if (!data.ok) {
          setReembedMsg({ type: "err", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
          return;
        }
        const processed = data.processed ?? 0;
        totalReembedded += data.reembedded ?? 0;
        totalFailed     += data.failed     ?? 0;
        offset          += processed;

        // Show live progress
        setReembedMsg({ type: "ok", text: `⏳ Re-embed: ${totalReembedded}/${data.total} chunks เสร็จแล้ว` });

        if (processed === 0) break;          // nothing left
        if (offset >= (data.total ?? 0)) break; // all done
      }
      setReembedMsg({
        type: "ok",
        text: `✅ Re-embed เสร็จทั้งหมด ${totalReembedded} chunks${totalFailed > 0 ? ` (ล้มเหลว ${totalFailed})` : ""}`,
      });
    } catch {
      setReembedMsg({ type: "err", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setReembedding(false);
    }
  };

  const handleModalSuccess = useCallback(async () => {
    await fetchSources();
    driveProcessing();
  }, [fetchSources, driveProcessing]);

  const totalChunks = sources.reduce((sum, s) => sum + (s.chunkCount ?? 0), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Knowledge Base</h1>
          <p className="text-sm text-text-muted mt-1">บอทดึงข้อมูลจากแหล่งเหล่านี้เพื่อตอบคำถามลูกค้าได้แม่นยำขึ้น</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus size={14} />Add Knowledge
        </button>
      </div>

      {autoSyncStatus && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700">
          <RefreshCw size={15} className="animate-spin flex-shrink-0" />
          <span>{autoSyncStatus}</span>
        </div>
      )}

      {/* Scrape URL */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-text-primary">Scrape URL</h2>
        </div>
        <p className="text-xs text-text-muted -mt-1">
          ใส่ URL ของหน้าที่ต้องการ เช่น หน้าราคา, หน้าสินค้า, หน้า FAQ — ระบบจะดึงเนื้อหาทั้งหมดของหน้านั้นมา
        </p>
        <div className="flex gap-2">
          <input
            type="url" value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlWarning(checkUrlWarning(e.target.value));
              setSyncMsg(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && !urlWarning && handleSync()}
            placeholder="https://your-website.com/pricing" disabled={syncing}
            className={[
              "flex-1 border rounded-xl px-3.5 py-2 text-sm bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 disabled:opacity-50",
              urlWarning
                ? "border-amber-400 focus:ring-amber-400/30 focus:border-amber-500"
                : "border-border-default focus:ring-brand-600/30 focus:border-brand-600",
            ].join(" ")}
          />
          <button
            onClick={handleSync} disabled={syncing || !url.trim() || !!urlWarning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Scraping..." : "Scrape"}
          </button>
        </div>

        {/* Real-time login warning */}
        {urlWarning && (
          <div className="flex items-start gap-2 text-xs rounded-xl px-3.5 py-2.5 bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <span>{urlWarning}</span>
          </div>
        )}

        {/* Static guidance */}
        {!urlWarning && (
          <p className="text-[11px] text-text-muted leading-relaxed">
            รองรับ: เว็บไซต์ทั่วไป, หน้าสินค้า, หน้า FAQ, บล็อก, เว็บที่ render ด้วย JavaScript
            &nbsp;·&nbsp;
            <span className="text-amber-600 font-medium">ไม่รองรับ</span>: เว็บที่ต้องล็อกอิน เช่น Facebook, Instagram, LinkedIn
            — หากต้องการเพิ่มเนื้อหาจากแพลตฟอร์มเหล่านั้น กรุณาคัดลอกมาเพิ่มเป็น &ldquo;ข้อความ&rdquo; แทน
          </p>
        )}

        {syncing && <p className="text-xs text-text-muted animate-pulse">กำลังดึงข้อมูล...</p>}

        {syncMsg && (
          <div className={[
            "flex items-start gap-2 text-xs rounded-xl px-3.5 py-2.5",
            syncMsg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200",
          ].join(" ")}>
            {syncMsg.type === "ok" ? <CheckCircle size={14} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />}
            {syncMsg.text}
          </div>
        )}
      </div>

      {/* Sources list */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Sources {sources.length > 0 && `(${sources.length})`}
          </h2>
          {totalChunks > 0 && (
            <span className="text-xs text-text-muted">{totalChunks.toLocaleString()} / 1,000 chunks</span>
          )}
        </div>

        {(loading || autoSyncStatus) && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !autoSyncStatus && sources.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Globe size={28} className="text-text-muted opacity-40" />
            <p className="text-sm text-text-muted">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-text-muted">
              Scrape URL หน้าย่อย หรือกด &ldquo;Add Knowledge&rdquo; เพื่อเพิ่มข้อความหรืออัปโหลดไฟล์
            </p>
          </div>
        )}

        {!loading && !autoSyncStatus && sources.map((s) => {
          const kind        = sourceKind(s.url);
          const isActive    = s.status === "pending" || s.status === "processing";
          const isFailed    = s.status === "failed";

          return (
            <div
              key={s.url}
              className={[
                "flex items-start gap-3 px-3.5 py-3 rounded-xl border",
                isFailed ? "bg-red-50 border-red-200" : isActive ? "bg-blue-50/40 border-blue-200" : "bg-surface-secondary border-border-default",
              ].join(" ")}
            >
              {kind === "file"   && <FileUp   size={14} className="text-amber-500  flex-shrink-0 mt-0.5" />}
              {kind === "custom" && <FileText size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />}
              {kind === "url"    && <Globe    size={14} className={`flex-shrink-0 mt-0.5 ${isActive ? "text-blue-500" : "text-brand-600"}`} />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-primary truncate">{sourceLabel(s.url)}</p>

                  {kind === "custom" && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md">custom</span>
                  )}
                  {kind === "file" && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">file</span>
                  )}

                  <StatusBadge source={s} />
                </div>

                {isActive && s.totalChunks && s.totalChunks > 0 ? (
                  <ProgressBar processed={s.processedChunks ?? 0} total={s.totalChunks} />
                ) : isFailed ? (
                  <p className="text-xs text-red-500 mt-0.5">
                    {s.errorMsg
                      ? s.errorMsg.length > 120
                        ? `ล้มเหลว: ${s.errorMsg.slice(0, 120)}…`
                        : `ล้มเหลว: ${s.errorMsg}`
                      : "embed ล้มเหลว — กรุณาลองใหม่"}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted mt-0.5">
                    {s.chunkCount} chunks
                    {" · "}
                    {kind === "url" ? "sync" : "เพิ่มเมื่อ"} {timeAgo(s.lastSyncAt)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleReembed(s.url)}
                  disabled={reembedding}
                  className="p-1.5 rounded-lg text-text-muted hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-40"
                  title="Re-embed source นี้ใหม่"
                >
                  <RefreshCw size={14} className={reembedding ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => handleDelete(s.url)}
                  disabled={deletingUrl === s.url}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  aria-label="ลบ"
                >
                  {deletingUrl === s.url
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Trash2    size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Re-embed button */}
      <div className="border border-border-default rounded-2xl p-4 space-y-3 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">🔄 Re-embed Knowledge Base</p>
            <p className="text-xs text-text-muted mt-0.5">
              ถ้า AI ยังไม่อ่านข้อมูลจาก Knowledge Base — กดปุ่มนี้เพื่อ rebuild embeddings ใหม่ทั้งหมด
            </p>
          </div>
          <button
            onClick={() => void handleReembed()}
            disabled={reembedding}
            className="shrink-0 px-4 py-2 rounded-xl border border-brand-600 text-brand-600 text-sm font-semibold hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {reembedding ? "กำลัง Re-embed..." : "Re-embed ทั้งหมด"}
          </button>
        </div>
        {reembedMsg && (
          <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 ${
            reembedMsg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            {reembedMsg.text}
          </div>
        )}
      </div>

      {/* Auto-refresh schedule */}
      <AutoRefreshCard />

      <p className="text-xs text-text-muted">
        บอทจะใช้ข้อมูลจาก Knowledge Base ควบคู่กับความรู้ทั่วไปเพื่อตอบคำถามลูกค้าได้แม่นยำขึ้น
      </p>

      {showModal && (
        <AddKnowledgeModal
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
