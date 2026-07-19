"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X, Send } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "bot"; content: string };

interface BotConfig {
  botName:        string;
  welcomeMessage: string;
  widgetColor:    string;
}

interface ZudoGuidePanelProps {
  tenantName?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LOGO_URL =
  "https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG";

const SUGGESTED_PROMPTS = [
  "วิธีติดตั้ง Widget บนเว็บไซต์",
  "หา </body> ในเว็บไซต์ได้ที่ไหน?",
  "ตั้งค่าบอทของฉันยังไง",
  "ต้องการให้ทีมงาน Zudobot ช่วยติดตั้ง",
];

// ── Session ID (lazy, avoids SSR mismatch) ────────────────────────────────────

function getOrCreateSessionId(): string {
  const KEY = "zudo_guide_sid";
  if (typeof sessionStorage === "undefined") return crypto.randomUUID();
  let sid = sessionStorage.getItem(KEY);
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(KEY, sid); }
  return sid;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ZudoGuidePanel({ tenantName }: ZudoGuidePanelProps) {
  const [isOpen,       setIsOpen]      = useState(false);
  const [initialized,  setInitialized] = useState(false);
  const [initError,    setInitError]   = useState(false);
  const [botConfig,    setBotConfig]   = useState<BotConfig | null>(null);
  const [messages,     setMessages]    = useState<Message[]>([]);
  const [input,        setInput]       = useState("");
  const [isTyping,     setIsTyping]    = useState(false);

  const sessionIdRef   = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // ── Init on first open ──────────────────────────────────────────────────────

  const runInit = useCallback(async () => {
    setInitError(false);
    try {
      const res  = await fetch("/api/internal/zudo-guide/init");
      const data = await res.json() as { ok: boolean; config?: BotConfig };
      if (!data.ok || !data.config) { setInitError(true); return; }
      setBotConfig(data.config);
      setMessages([{ role: "bot", content: data.config.welcomeMessage }]);
      setInitialized(true);
    } catch {
      setInitError(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !initialized && !initError) runInit();
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen, initialized, initError, runInit]);

  // ── Escape key ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping || !initialized) return;

    if (!sessionIdRef.current) sessionIdRef.current = getOrCreateSessionId();

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsTyping(true);

    try {
      const res  = await fetch("/api/internal/zudo-guide/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: sessionIdRef.current, message: trimmed }),
      });
      const data = await res.json() as { ok: boolean; reply?: string };
      setMessages((prev) => [...prev, {
        role:    "bot",
        content: data.reply ?? "ขออภัยครับ ไม่สามารถตอบได้ในขณะนี้",
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role:    "bot",
        content: "ขออภัยครับ เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง",
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isTyping, initialized]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat window ──────────────────────────────────────────────────────── */}
      <div
        className={[
          "fixed bottom-24 right-6 z-50 w-80 flex flex-col",
          "bg-white rounded-2xl shadow-2xl border border-gray-200",
          "transition-all duration-300 ease-in-out origin-bottom-right",
          isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
        style={{ height: "480px" }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/80 rounded-t-2xl flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Image
              src={LOGO_URL}
              alt="Zudobot"
              width={24}
              height={24}
              className="object-contain block"
              style={{ animation: "zg-spin 60s linear infinite" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {botConfig?.botName ?? "Zudo Guide"}
            </p>
            <p className="text-xs text-gray-400 leading-tight truncate">
              {tenantName ? `สวัสดี, ${tenantName}` : "ผู้ช่วยดูแล Zudobot ของคุณ"}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="ปิด Zudo Guide"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {!initialized && !initError && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {initError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-gray-500">ไม่สามารถโหลด Zudo Guide ได้</p>
              <button
                onClick={runInit}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                ลองใหม่
              </button>
            </div>
          )}

          {initialized && messages.map((msg, i) => (
            <div
              key={i}
              className={["flex", msg.role === "user" ? "justify-end" : "justify-start"].join(" ")}
            >
              <div
                className={[
                  "max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm",
                ].join(" ")}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {initialized && messages.length === 1 && !isTyping && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-gray-400 font-medium">คำถามที่พบบ่อย</p>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-xs px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์คำถาม..."
              maxLength={800}
              disabled={!initialized || isTyping}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!initialized || isTyping || !input.trim()}
              aria-label="ส่ง"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">Powered by Zudobot</p>
        </div>
      </div>

      {/* ── Bubble button ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "ปิด Zudo Guide" : "เปิด Zudo Guide"}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
      >
        {/* Logo (shown when closed) */}
        {!isOpen && (
          <Image
            src={LOGO_URL}
            alt=""
            width={42}
            height={42}
            className="object-contain block"
            style={{ animation: "zg-spin 60s linear infinite" }}
          />
        )}
        {/* X (shown when open) */}
        {isOpen && <X size={22} color="#fff" strokeWidth={2.5} />}
      </button>

      {/* ── Keyframes ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes zg-spin {
          0%   { transform: rotate(0deg);   animation-timing-function: cubic-bezier(0.4,0,0.2,1); }
          5%   { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
