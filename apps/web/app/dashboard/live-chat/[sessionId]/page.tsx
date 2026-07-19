"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface ChatMessage {
  role: "user" | "model" | "admin";
  content: string;
  timestamp: string;
}

interface SessionData {
  sessionId: string;
  visitorId: string | null;
  botStatus: "bot" | "handoff_pending" | "handoff_active" | "resolved" | "paused";
  handoffAt: string | null;
  messages: ChatMessage[];
  lastActiveAt: string;
  sentiment?: number; // 0-10 scale
  intent?: string;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  bot:              { text: "บอทกำลังทำงาน",           color: "bg-gray-400" },
  handoff_pending:  { text: "รอเจ้าหน้าที่รับ",         color: "bg-amber-400" },
  handoff_active:   { text: "เจ้าหน้าที่กำลังดูแล",     color: "bg-green-500" },
  resolved:         { text: "จบการสนทนาแล้ว",           color: "bg-gray-400" },
  paused:           { text: "บอทถูกหยุดชั่วคราว",       color: "bg-blue-500" },
};

function thTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function getSentimentColor(sentiment?: number): string {
  if (sentiment === undefined) return "border-gray-300";
  if (sentiment <= 2) return "border-green-500"; // Positive
  if (sentiment <= 5) return "border-yellow-500"; // Neutral
  if (sentiment <= 7) return "border-orange-500"; // Frustrated
  if (sentiment <= 9) return "border-red-500"; // Angry
  return "border-red-700"; // Crisis
}

function Bubble({ msg, sentiment }: { msg: ChatMessage; sentiment?: number }) {
  const isAdmin = msg.role === "admin";
  const isUser  = msg.role === "user";

  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"} mb-3`}>
      <div className="max-w-[75%]">
        <p className={`text-[10px] mb-1 ${isAdmin ? "text-right text-brand-600" : "text-left text-text-muted"}`}>
          {isAdmin ? "คุณ (เจ้าหน้าที่)" : isUser ? "ลูกค้า" : "Zudobot"}
        </p>
        <div
          className={[
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
            isAdmin
              ? "bg-brand-600 text-white rounded-br-sm"
              : isUser
              ? `bg-surface-primary border-2 ${getSentimentColor(sentiment)} text-text-primary rounded-bl-sm`
              : "bg-surface-secondary text-text-secondary rounded-bl-sm",
          ].join(" ")}
        >
          {msg.content}
        </div>
        <p className={`text-[10px] mt-1 text-text-muted ${isAdmin ? "text-right" : "text-left"}`}>
          {thTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function LiveChatPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessionId    = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const deepLinkToken = searchParams.get("token");

  const [session, setSession]         = useState<SessionData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [reply, setReply]             = useState("");
  const [sending, setSending]         = useState(false);
  const [ending, setEnding]           = useState(false);
  const [pausing, setPausing]         = useState(false);
  const [resuming, setResuming]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<"valid" | "expired" | "used" | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/live-chat/${sessionId}/history`);
      if (!res.ok) throw new Error();
      const data: SessionData = await res.json();
      setSession(data);
    } catch {
      // keep existing data on poll failures
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Validate deep link token if present (audit trail + UX feedback)
  useEffect(() => {
    if (!deepLinkToken) return;
    fetch(`/api/tenant/live-chat/validate-deep-link?token=${encodeURIComponent(deepLinkToken)}&sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d: { valid: boolean; error?: string }) => {
        if (d.valid) {
          setTokenStatus("valid");
        } else if (d.error === "token_already_used") {
          setTokenStatus("used");
        } else {
          setTokenStatus("expired");
        }
      })
      .catch(() => {});
  }, [deepLinkToken, sessionId]);

  // Initial load + polling every 3s
  useEffect(() => {
    fetchSession();
    pollRef.current = setInterval(fetchSession, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSession]);

  // Stop polling when resolved
  useEffect(() => {
    if (session?.botStatus === "resolved" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [session?.botStatus]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  async function handleSend() {
    if (!reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/live-chat/${sessionId}/reply`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "send_failed");
      }
      setReply("");
      await fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    if (ending) return;
    setEnding(true);
    try {
      await fetch(`/api/tenant/live-chat/${sessionId}/end`, { method: "POST" });
      await fetchSession();
    } catch {
      setError("ไม่สามารถจบการสนทนาได้ กรุณาลองใหม่");
    } finally {
      setEnding(false);
    }
  }

  async function handlePause() {
    if (pausing) return;
    setPausing(true);
    try {
      await fetch(`/api/tenant/live-chat/${sessionId}/pause`, { method: "POST" });
      await fetchSession();
    } catch {
      setError("ไม่สามารถหยุดบอทได้ กรุณาลองใหม่");
    } finally {
      setPausing(false);
    }
  }

  async function handleResume() {
    if (resuming) return;
    setResuming(true);
    try {
      await fetch(`/api/tenant/live-chat/${sessionId}/resume`, { method: "POST" });
      await fetchSession();
    } catch {
      setError("ไม่สามารถเริ่มบอทใหม่ได้ กรุณาลองใหม่");
    } finally {
      setResuming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted text-sm">ไม่พบการสนทนานี้</p>
        <button onClick={() => router.back()} className="mt-3 text-brand-600 text-sm hover:underline">
          ← กลับ
        </button>
      </div>
    );
  }

  const status     = STATUS_LABEL[session.botStatus] ?? STATUS_LABEL.bot;
  const isResolved = session.botStatus === "resolved";
  const canReply   = !isResolved;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)]">
      {/* Deep link token notice */}
      {deepLinkToken && tokenStatus && (
        <div className={`mb-2 px-4 py-2 rounded-xl text-xs font-medium text-center flex-shrink-0 ${
          tokenStatus === "valid"   ? "bg-green-50 text-green-700 border border-green-200" :
          tokenStatus === "used"    ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                      "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {tokenStatus === "valid"   ? "✅ ลิงก์จาก LINE Notify — ยืนยันแล้ว (ใช้งานแล้วถูกยกเลิก)" :
           tokenStatus === "used"    ? "⚠️ ลิงก์นี้ถูกใช้งานแล้ว" :
                                       "⏰ ลิงก์นี้หมดอายุแล้ว (เกิน 10 นาที)"}
        </div>
      )}

      {/* Header — responsive layout */}
      <div className="card-premium p-3 md:p-4 mb-3 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary text-sm truncate">
              {session.visitorId ? `Visitor: ${session.visitorId}` : "Visitor: anonymous"}
            </p>
            <p className="text-xs text-text-muted truncate">Session: {session.sessionId}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.color}`} />
            <span className="text-xs text-text-secondary font-medium">{status.text}</span>
            {session.sentiment !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                session.sentiment <= 2 ? "bg-green-50 text-green-700" :
                session.sentiment <= 5 ? "bg-yellow-50 text-yellow-700" :
                session.sentiment <= 7 ? "bg-orange-50 text-orange-700" :
                session.sentiment <= 9 ? "bg-red-50 text-red-700" :
                                          "bg-red-100 text-red-800"
              }`}>
                Sentiment {session.sentiment}/10
              </span>
            )}
            {session.intent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium border border-brand-100">
                {session.intent}
              </span>
            )}
          </div>
        </div>
        {canReply && (
          <div className="flex gap-2 flex-wrap">
            {session.botStatus === "paused" ? (
              <button
                onClick={handleResume}
                disabled={resuming}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 active:scale-95 transition-all disabled:opacity-50"
              >
                {resuming ? "กำลังเริ่ม..." : "▶ เริ่มบอทใหม่"}
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={pausing}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-50"
              >
                {pausing ? "กำลังหยุด..." : "⏸ หยุดบอทชั่วคราว"}
              </button>
            )}
            <button
              onClick={handleEnd}
              disabled={ending}
              className="flex-1 min-w-[100px] px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {ending ? "กำลังจบ..." : "✕ จบการสนทนา"}
            </button>
          </div>
        )}
      </div>

      {isResolved && (
        <div className="mb-3 px-4 py-3 rounded-xl bg-gray-50 border border-border-default text-sm text-text-muted text-center">
          การสนทนาจบแล้ว — บอทกลับมาทำงานตามปกติแล้ว
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto card-premium p-4 mb-3">
        {session.messages.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">ยังไม่มีข้อความ</p>
        )}
        {session.messages.map((msg, i) => (
          <Bubble key={i} msg={msg} sentiment={msg.role === "user" ? session.sentiment : undefined} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {canReply && (
        <div className="card-premium p-3 flex-shrink-0">
          {error && (
            <p className="text-xs text-red-500 mb-2 px-1">{error}</p>
          )}
          <div className="flex gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="พิมพ์ข้อความตอบลูกค้า... (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 self-end"
            >
              {sending ? "..." : "ส่ง"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
