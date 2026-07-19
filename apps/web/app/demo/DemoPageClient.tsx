"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScenarioSwitcher } from "@/components/sandbox/ScenarioSwitcher";
import { ChatWindow } from "@/components/sandbox/ChatWindow";
import { WebsitePreview } from "@/components/sandbox/WebsitePreview";
import { SANDBOX_SCENARIOS, SCENARIO_ORDER } from "@/components/sandbox/scenarios";
import type { ScenarioId } from "@/components/sandbox/scenarios";
import type { SandboxMessage } from "@/lib/ai/geminiSandbox";
import { useLang } from "@/lib/i18n";

const CTA_TRIGGER = 5;

export function DemoPageClient() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const initialScenario = (searchParams.get("scenario") as ScenarioId | null) ?? SCENARIO_ORDER[0];
  const validInitial = SANDBOX_SCENARIOS[initialScenario] ? initialScenario : SCENARIO_ORDER[0];

  const [scenarioId, setScenarioId] = useState<ScenarioId>(validInitial);
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = SANDBOX_SCENARIOS[scenarioId];
  const userMessages = messages.filter((m) => m.role === "user").length;

  const switchScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id);
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
    setShowCta(false);
    setCtaDismissed(false);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading || userMessages >= 20) return;

      const newUserMsg: SandboxMessage = { role: "user", content: text };
      const updatedMessages = [...messages, newUserMsg];
      setMessages(updatedMessages);
      setInputValue("");
      setIsLoading(true);
      setError(null);

      const nextUserCount = userMessages + 1;
      if (nextUserCount >= CTA_TRIGGER && !ctaDismissed && !showCta) {
        setShowCta(true);
      }

      try {
        const res = await fetch("/api/sandbox/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId,
            history: messages,
            message: text,
            messageCount: nextUserCount,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errMsg =
            res.status === 429
              ? (data.message as string | undefined) ?? t("demo.rateLimit")
              : t("demo.error");
          setError(errMsg);
          setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        }
      } catch {
        const fallback = t("demo.networkError");
        setError(fallback);
        setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, scenarioId, userMessages, showCta, ctaDismissed, t]
  );

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Page header */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs uppercase tracking-widest text-text-muted font-medium">
                {t("demo.eyebrow")}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 border border-brand-200 font-medium">
                {t("demo.badge")}
              </span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
              {t("demo.title")}{" "}
              <span className="text-grad-blue">{t("demo.titleBrand")}</span>{" "}
              <span className="text-grad-gold">{t("demo.titleNow")}</span>
            </h1>
            <p className="text-text-muted text-sm mt-1">{t("demo.subtitle")}</p>
          </div>

          {/* Scenario switcher */}
          <div className="mb-4">
            <ScenarioSwitcher active={scenarioId} onChange={switchScenario} />
          </div>

          {/* Scenario info strip */}
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl bg-surface-primary border border-border-default">
            <span className="text-xl">{scenario.icon}</span>
            <div>
              <span className="text-sm font-semibold text-text-primary">{scenario.mockBusiness.name}</span>
              <span className="mx-2 text-border-strong">·</span>
              <span className="text-sm text-text-muted">{scenario.botName}</span>
            </div>
            <span className="ml-auto text-xs text-text-muted hidden sm:block">{scenario.sublabel}</span>
          </div>

          {/* Split layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: "clamp(500px, 65vh, 700px)" }}>
            {/* Left: website preview (desktop only) */}
            <div className="hidden lg:block h-full">
              <WebsitePreview scenario={scenario} />
            </div>

            {/* Right: chat window */}
            <div className="h-full">
              <ChatWindow
                scenario={scenario}
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
                inputValue={inputValue}
                onInputChange={setInputValue}
                showCta={showCta && !ctaDismissed}
                onCtaDismiss={() => { setShowCta(false); setCtaDismissed(true); }}
              />
            </div>
          </div>

          {/* Error strip */}
          {error && (
            <div className="mt-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Bottom CTA strip */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-surface-primary border border-border-default">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("demo.bottomTitle")}</p>
              <p className="text-xs text-text-muted mt-0.5">{t("demo.bottomSub")}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a href="/#pricing" className="text-sm text-text-secondary hover:text-brand-600 transition-colors">
                {t("demo.viewPricing")}
              </a>
              <a
                href="/register"
                className="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl transition-colors shadow-brand i18n-compact-btn"
              >
                {t("demo.signUp")}
              </a>
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-text-muted">{t("demo.pdpaNote")}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
