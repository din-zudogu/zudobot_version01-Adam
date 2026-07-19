"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface BotConfig {
  botName:        string;
  welcomeMessage: string;
  widgetColor:    string;
  widgetPosition: string;
}

interface Message {
  role:    "user" | "bot";
  content: string;
}

function getOrCreateSessionId(): string {
  const key = "zudobot_embed_sid";
  let sid   = sessionStorage.getItem(key);
  if (!sid) {
    sid = typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

// ── Inner component (needs useSearchParams) ───────────────────────

function EmbedInner() {
  const searchParams = useSearchParams();
  const embedKey     = searchParams.get("key")   ?? "";
  const colorParam   = searchParams.get("color") ?? "";
  const posParam     = searchParams.get("pos")   ?? "right";

  const [config,   setConfig]   = useState<BotConfig | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [isOpen,   setIsOpen]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [typing,   setTyping]   = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  // ── Fetch bot config ─────────────────────────────────────────────
  useEffect(() => {
    if (!embedKey) { setError("missing_key"); return; }

    fetch(`/api/embed/config?key=${encodeURIComponent(embedKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setError(data.error ?? "error"); return; }
        const cfg: BotConfig = {
          botName:        data.botName,
          welcomeMessage: data.welcomeMessage,
          widgetColor:    colorParam || data.widgetColor || "#1E5BC6",
          widgetPosition: posParam   || data.widgetPosition || "right",
        };
        setConfig(cfg);
        setMessages([{ role: "bot", content: cfg.welcomeMessage }]);
      })
      .catch(() => setError("network_error"));
  }, [embedKey, colorParam, posParam]);

  // ── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── PostMessage to parent (resize iframe) ────────────────────────
  function notifyParent(open: boolean) {
    window.parent.postMessage(open ? "zudobot:open" : "zudobot:close", "*");
  }

  function toggleChat() {
    const next = !isOpen;
    setIsOpen(next);
    notifyParent(next);
  }

  // ── Inbound commands from parent (ZudobotLoader.open/close) ──────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === "zudobot:cmd:open")  { setIsOpen(true);  notifyParent(true);  }
      if (e.data === "zudobot:cmd:close") { setIsOpen(false); notifyParent(false); }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message ─────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || typing || !config) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setTyping(true);

    try {
      const res  = await fetch("/api/embed/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: embedKey, sessionId: getOrCreateSessionId(), message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", content: data.reply ?? "ขออภัย เกิดข้อผิดพลาด" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", content: "ขออภัยครับ ระบบขัดข้องชั่วคราว" }]);
    } finally {
      setTyping(false);
    }
  }

  // ── Error / loading states ────────────────────────────────────────
  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: posParam === "left" ? "flex-start" : "flex-end", width: "100%", height: "100%", padding: 8 }}>
        <button
          disabled
          style={{ width: 56, height: 56, borderRadius: "50%", background: "#e5e7eb", border: "none", cursor: "not-allowed" }}
          title={error}
        >
          ⚠️
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", width: "100%", height: "100%", padding: 8 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e5e7eb", animation: "pulse 1.5s infinite" }} />
      </div>
    );
  }

  const { botName, widgetColor, widgetPosition } = config;
  const isLeft = widgetPosition === "bottom-left" || posParam === "left";

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     isLeft ? "flex-start" : "flex-end",
      justifyContent: "flex-end",
      width:          "100%",
      height:         "100%",
      padding:        8,
      boxSizing:      "border-box",
    }}>
      {/* Chat window */}
      {isOpen && (
        <div style={{
          display:       "flex",
          flexDirection: "column",
          width:         "100%",
          height:        520,
          background:    "#fff",
          borderRadius:  16,
          boxShadow:     "0 8px 32px rgba(0,0,0,0.18)",
          overflow:      "hidden",
          marginBottom:  12,
          border:        "1px solid #e5e7eb",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: widgetColor, color: "#fff" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{botName}</span>
            <button
              onClick={toggleChat}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}
              aria-label="ปิดแชท"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", background: "#f8faff", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  maxWidth:     "85%",
                  alignSelf:    m.role === "user" ? "flex-end" : "flex-start",
                  background:   m.role === "user" ? widgetColor : "#fff",
                  color:        m.role === "user" ? "#fff" : "#1a2332",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding:      "10px 14px",
                  fontSize:     14,
                  lineHeight:   1.5,
                  border:       m.role === "bot" ? "1px solid #e5e7eb" : "none",
                  boxShadow:    m.role === "bot" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                  whiteSpace:   "pre-wrap",
                  wordBreak:    "break-word",
                }}
              >
                {m.content}
              </div>
            ))}
            {typing && (
              <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: "14px 14px 14px 4px", padding: "10px 16px", border: "1px solid #e5e7eb", fontSize: 20, letterSpacing: 4 }}>
                •••
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", borderTop: "1px solid #e5e7eb" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="พิมพ์ข้อความ..."
              maxLength={800}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", color: "#1a2332" }}
            />
            <button
              onClick={sendMessage}
              disabled={typing || !input.trim()}
              style={{
                padding:       "8px 16px",
                background:    typing || !input.trim() ? "#d1d5db" : widgetColor,
                color:         "#fff",
                border:        "none",
                borderRadius:  10,
                cursor:        typing || !input.trim() ? "not-allowed" : "pointer",
                fontSize:      14,
                fontWeight:    600,
                transition:    "background 0.2s",
              }}
            >
              ส่ง
            </button>
          </div>
        </div>
      )}

      {/* Toggle bubble */}
      <button
        onClick={toggleChat}
        style={{
          width:        56,
          height:       56,
          borderRadius: "50%",
          background:   widgetColor,
          color:        "#fff",
          border:       "none",
          cursor:       "pointer",
          fontSize:     24,
          boxShadow:    "0 4px 16px rgba(0,0,0,0.22)",
          transition:   "transform 0.15s",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          flexShrink:   0,
        }}
        aria-label={isOpen ? "ปิดแชท" : "เปิดแชท"}
      >
        {isOpen ? "↓" : "💬"}
      </button>
    </div>
  );
}

// ── Page export with Suspense (useSearchParams requires it) ────────

export default function EmbedPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", width: "100%", height: "100%", padding: 8 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e5e7eb" }} />
      </div>
    }>
      <EmbedInner />
    </Suspense>
  );
}
