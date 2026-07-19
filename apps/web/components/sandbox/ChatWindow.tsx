"use client";

import { useEffect, useRef } from "react";
import type { SandboxScenario } from "./scenarios";
import type { SandboxMessage } from "@/lib/ai/geminiSandbox";

const SESSION_LIMIT = 20;

interface Props {
  scenario: SandboxScenario;
  messages: SandboxMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  showCta: boolean;
  onCtaDismiss: () => void;
}

export function ChatWindow({
  scenario,
  messages,
  isLoading,
  onSend,
  inputValue,
  onInputChange,
  showCta,
  onCtaDismiss,
}: Props) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userMessages = messages.filter((m) => m.role === "user").length;
  const atLimit = userMessages >= SESSION_LIMIT;

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading || atLimit) return;
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const progressPct = Math.min((userMessages / SESSION_LIMIT) * 100, 100);
  const progressColor =
    progressPct >= 90
      ? "bg-red-500"
      : progressPct >= 60
      ? "bg-gold-500"
      : "bg-brand-500";

  return (
    <div className="flex flex-col h-full bg-surface-primary rounded-2xl border border-border-default overflow-hidden shadow-card">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border-default"
        style={{ background: `${scenario.themeColor}12` }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: scenario.themeColor }}
        >
          {scenario.botName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{scenario.botName}</p>
          <p className="text-xs text-text-muted truncate">{scenario.mockBusiness.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-text-muted">Online</span>
        </div>
      </div>

      {/* Message count bar */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">ข้อความ Sandbox</span>
          <span
            className={`text-xs font-medium tabular-nums ${
              atLimit ? "text-red-500" : progressPct >= 70 ? "text-gold-600" : "text-text-secondary"
            }`}
          >
            {userMessages}/{SESSION_LIMIT}
          </span>
        </div>
        <div className="h-1 w-full bg-surface-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3"
              style={{ background: `${scenario.themeColor}18` }}
            >
              {scenario.icon}
            </div>
            <p className="text-text-muted text-sm px-6">{scenario.greeting}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: scenario.themeColor }}
              >
                {scenario.botName.charAt(0)}
              </div>
            )}
            <div
              className={[
                "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-surface-secondary text-text-primary rounded-bl-sm border border-border-default",
              ].join(" ")}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: scenario.themeColor }}
            >
              {scenario.botName.charAt(0)}
            </div>
            <div className="bg-surface-secondary border border-border-default px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

      </div>

      {/* Quick replies */}
      {messages.length <= 1 && !isLoading && !atLimit && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {scenario.quickReplies.slice(0, 3).map((qr, i) => (
            <button
              key={i}
              onClick={() => onSend(qr)}
              className="text-xs px-3 py-1.5 rounded-full border border-border-default bg-surface-primary text-text-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* CTA overlay */}
      {showCta && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-gold-50 border border-gold-300 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">🚀</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gold-800">สนใจใช้งานจริงไหม?</p>
            <p className="text-xs text-gold-700 mt-0.5">ทดลองฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/register"
              className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              สมัครฟรี
            </a>
            <button onClick={onCtaDismiss} className="text-gold-600 hover:text-gold-800 text-lg leading-none">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Limit message */}
      {atLimit && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-surface-secondary border border-border-default text-center">
          <p className="text-xs text-text-muted mb-2">คุณใช้ครบ 20 ข้อความแล้ว</p>
          <a
            href="/register"
            className="inline-block text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors"
          >
            ทดลองใช้จริงฟรี 14 วัน →
          </a>
        </div>
      )}

      {/* Input */}
      {!atLimit && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-4">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`พิมพ์คำถามถึง ${scenario.botName}...`}
            disabled={isLoading}
            maxLength={500}
            className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
