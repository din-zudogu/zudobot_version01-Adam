"use client";

import { kbFetch } from "@/lib/knowledge/kbFetch";
import { getPlatformKbCoreUrlsFromEnv } from "@/lib/knowledge/platformKbCoreUrls";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trash2, RefreshCw, Globe, AlertCircle, CheckCircle,
  FileText, Plus, X, Link2, FileUp, Loader2,
} from "lucide-react";

const PLATFORM_KB = true;

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
          try { res = await kbFetch("/api/tenant/knowledge/upload", { method: "POST", body: fd }, PLATFORM_KB); }
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
          res = await kbFetch("/api/tenant/knowledge/custom", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ title: title.trim(), content: content.trim() }),
          }, PLATFORM_KB);
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

// ── Main page ─────────────────────────────────────────────────────

export default function AdminPlatformKnowledgePage() {
  const [sources,        setSources]        = useState<KnowledgeSource[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [platformCoreSyncing,  setPlatformCoreSyncing]  = useState(false);
  const [platformCoreSyncMsg,  setPlatformCoreSyncMsg]  = useState<string | null>(null);
  const [url,                  setUrl]                  = useState("");
  const [syncing,              setSyncing]              = useState(false);
  const [syncMsg,              setSyncMsg]              = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [deletingUrl,    setDeletingUrl]    = useState<string | null>(null);
  const [showModal,      setShowModal]      = useState(false);

  // Tracks the latest sources without stale-closure issues in callbacks
  const sourcesRef      = useRef<KnowledgeSource[]>([]);
  // Guard: prevents concurrent driveProcessing loops
  const isProcessingRef = useRef(false);

  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  const fetchSources = useCallback(async (): Promise<KnowledgeSource[]> => {
    try {
      const res  = await kbFetch("/api/tenant/knowledge", undefined, PLATFORM_KB);
      const data = await res.json();
      const list: KnowledgeSource[] = data.sources ?? [];
      setSources(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Drives background embedding: fires /process for every active source in a loop,
  // refreshing state after each round. Guarded so only one loop runs at a time.
  const driveProcessing = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const active = sourcesRef.current.filter(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (active.length === 0) break;

        // Fire /process for all active sources in parallel — each call embeds one batch
        await Promise.allSettled(
          active.map((s) =>
            kbFetch("/api/tenant/knowledge/process", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ sourceUrl: s.url }),
            }, PLATFORM_KB).catch(() => null),
          ),
        );

        // Refresh UI after the round
        const updated = await fetchSources();
        const remaining = updated.filter(
          (s) => s.status === "pending" || s.status === "processing",
        );
        if (remaining.length === 0) break;

        // Short pause between rounds to avoid hammering the API
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
        await fetchSources();
        driveProcessing();
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [fetchSources, driveProcessing]);

  const handlePlatformCoreSync = async () => {
    if (platformCoreSyncing) return;

    setPlatformCoreSyncing(true);
    setPlatformCoreSyncMsg(null);

    let coreUrls: string[];
    try {
      coreUrls = getPlatformKbCoreUrlsFromEnv();
    } catch (err) {
      const message = err instanceof Error ? err.message : "config_error";
      setPlatformCoreSyncMsg(message);
      setPlatformCoreSyncing(false);
      return;
    }

    const existingSources = await fetchSources();
    const syncedUrls = new Set(existingSources.map((s) => s.url));
    const targets = coreUrls.filter((u) => !syncedUrls.has(u));

    if (targets.length === 0) {
      setPlatformCoreSyncMsg("หน้าการตลาดหลักถูก sync ครบแล้ว — ไม่มี URL ที่ต้องประมวลผลเพิ่ม");
      setPlatformCoreSyncing(false);
      return;
    }

    let okCount = 0;
    const failures: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const targetUrl = targets[i];
      setPlatformCoreSyncMsg(`กำลัง sync ${i + 1}/${targets.length}: ${targetUrl}`);

      try {
        const res = await kbFetch("/api/tenant/knowledge/sync", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: targetUrl }),
        }, PLATFORM_KB);
        const data = await res.json() as { ok?: boolean; error?: string; detail?: string };

        if (res.ok && data.ok) {
          okCount += 1;
        } else {
          failures.push(`${targetUrl} (${data.error ?? res.status})`);
        }
      } catch {
        failures.push(`${targetUrl} (network_error)`);
      }
    }

    await fetchSources();
    driveProcessing();

    if (failures.length === 0) {
      setPlatformCoreSyncMsg(`ซิงค์สำเร็จ ${okCount}/${targets.length} URL`);
    } else {
      setPlatformCoreSyncMsg(
        `ซิงค์สำเร็จ ${okCount}/${targets.length} URL — ล้มเหลว: ${failures.join("; ")}`
      );
    }

    setPlatformCoreSyncing(false);
  };

  const handleSync = async () => {
    if (!url.trim() || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await kbFetch("/api/tenant/knowledge/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() }),
      }, PLATFORM_KB);
      const data = await res.json();
      if (data.ok) {
        setSyncMsg({ type: "ok", text: `Scrape สำเร็จ — กำลัง embed ${data.totalChunks} chunks ในพื้นหลัง` });
        setUrl("");
        await fetchSources();
        driveProcessing();
      } else {
        const msgs: Record<string, string> = {
          url_required:      "กรุณาใส่ URL",
          invalid_url:       "URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)",
          scrape_failed:     `ดึงข้อมูลไม่ได้: ${data.detail ?? ""}`,
          content_too_short: "เนื้อหาน้อยเกินไป",
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
      await kbFetch("/api/tenant/knowledge", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: sourceUrl }),
      }, PLATFORM_KB);
      await fetchSources();
    } finally {
      setDeletingUrl(null);
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
          <h1 className="text-2xl font-bold text-text-primary">Knowledge Base — zudobot.zudogu.com</h1>
          <p className="text-sm text-text-muted mt-1">
            กำหนดข้อมูลสินค้าและบริการของเว็บไซต์ Zudobot สำหรับ Widget ที่ติดตั้งบน zudobot.zudogu.com และ Admin Dashboard
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus size={14} />Add Knowledge
        </button>
      </div>

      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-text-primary">Platform Core KB</h2>
        </div>
        <p className="text-xs text-text-muted">
          ซิงค์หน้าการตลาดหลักของ zudobot.zudogu.com ตามรายการ URL ใน Amplify (
          <code className="text-[11px]">NEXT_PUBLIC_PLATFORM_KB_CORE_URLS</code>
          ) — กดเมื่อต้องการเท่านั้น ไม่มีการ sync อัตโนมัติตอนเปิดหน้า
        </p>
        <button
          type="button"
          onClick={() => void handlePlatformCoreSync()}
          disabled={platformCoreSyncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={14} className={platformCoreSyncing ? "animate-spin" : ""} />
          {platformCoreSyncing ? "กำลังซิงค์..." : "ซิงค์ข้อมูลหน้าการตลาดหลัก (Sync Platform Core KB)"}
        </button>
        {platformCoreSyncMsg && (
          <p className="text-xs text-text-secondary rounded-xl px-3.5 py-2.5 bg-surface-secondary border border-border-default">
            {platformCoreSyncMsg}
          </p>
        )}
      </div>

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
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSync()}
            placeholder="https://zudobot.zudogu.com/pricing" disabled={syncing}
            className="flex-1 border border-border-default rounded-xl px-3.5 py-2 text-sm bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 disabled:opacity-50"
          />
          <button
            onClick={handleSync} disabled={syncing || !url.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Scraping..." : "Scrape"}
          </button>
        </div>

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

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && sources.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Globe size={28} className="text-text-muted opacity-40" />
            <p className="text-sm text-text-muted">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-text-muted">
              Scrape URL หน้าย่อย หรือกด &ldquo;Add Knowledge&rdquo; เพื่อเพิ่มข้อความหรืออัปโหลดไฟล์
            </p>
          </div>
        )}

        {!loading && sources.map((s) => {
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
                    {s.errorMsg ? `ล้มเหลว: ${s.errorMsg.slice(0, 80)}` : "embed ล้มเหลว — กรุณาลองใหม่"}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted mt-0.5">
                    {s.chunkCount} chunks
                    {" · "}
                    {kind === "url" ? "sync" : "เพิ่มเมื่อ"} {timeAgo(s.lastSyncAt)}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleDelete(s.url)}
                disabled={deletingUrl === s.url}
                className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                aria-label="ลบ"
              >
                {deletingUrl === s.url
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Trash2    size={14} />}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted">
        บอทจะใช้ข้อมูลจาก Knowledge Base ควบคู่กับ Google Search เพื่อตอบคำถามลูกค้าได้แม่นยำขึ้น
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
