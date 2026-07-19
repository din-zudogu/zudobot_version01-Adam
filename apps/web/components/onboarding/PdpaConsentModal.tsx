"use client";

import { useEffect, useRef, useState } from "react";
import { LegalDocumentBody } from "@/components/legal/LegalDocumentModal";

type Choice = "accept" | "decline" | null;

function DeclineNoticeModal({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4"
      style={{ background: "rgba(13,24,41,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div className="card-premium w-full max-w-sm p-7 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-3xl mx-auto mb-4">
          ⚠️
        </div>
        <p className="text-sm text-text-secondary leading-relaxed mb-7">
          การยอมรับการเปิดเผยข้อมูลส่วนบุคคล จะทำให้ท่านสามารถใช้งาน ZUDOBOT ได้อย่างสมบูรณ์
        </p>
        <button
          onClick={onBack}
          className="w-full px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          กลับไปทำรายการ
        </button>
      </div>
    </div>
  );
}

export function PdpaConsentModal({ onAccept }: { onAccept: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [choice, setChoice] = useState<Choice>(null);
  const [showDecline, setShowDecline] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    function check() {
      if (!el) return;
      const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      if (atEnd) setScrolledToEnd(true);
    }

    // Content already fits without scrolling — enable immediately.
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, []);

  function handleConfirm() {
    if (choice === "accept") onAccept();
    else if (choice === "decline") setShowDecline(true);
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-4 py-10">
      {showDecline && <DeclineNoticeModal onBack={() => setShowDecline(false)} />}

      <div
        className="card-premium w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        <div className="px-6 py-4 border-b border-border-default shrink-0">
          <h2 className="font-heading text-lg font-bold text-text-primary">
            ข้อตกลงการเปิดเผยข้อมูลส่วนบุคคล (PDPA)
          </h2>
          <p className="text-xs text-text-muted mt-0.5">กรุณาอ่านและเลื่อนจนสุดข้อความก่อนดำเนินการต่อ</p>
        </div>

        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-6 py-5 min-h-0"
          style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
        >
          <LegalDocumentBody documentType="DATA_PROCESSING_AGREEMENT" />
        </div>

        <div className="px-6 py-4 border-t border-border-default shrink-0 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <label
              className={[
                "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all",
                !scrolledToEnd && "opacity-50 pointer-events-none",
                choice === "accept" ? "border-brand-500 bg-brand-50" : "border-border-default bg-surface-secondary hover:border-brand-300",
              ].filter(Boolean).join(" ")}
            >
              <input
                type="radio"
                name="pdpa-choice"
                disabled={!scrolledToEnd}
                checked={choice === "accept"}
                onChange={() => setChoice("accept")}
                className="accent-brand-600"
              />
              <span className="text-sm font-medium text-text-primary">ยอมรับ</span>
            </label>
            <label
              className={[
                "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all",
                !scrolledToEnd && "opacity-50 pointer-events-none",
                choice === "decline" ? "border-brand-500 bg-brand-50" : "border-border-default bg-surface-secondary hover:border-brand-300",
              ].filter(Boolean).join(" ")}
            >
              <input
                type="radio"
                name="pdpa-choice"
                disabled={!scrolledToEnd}
                checked={choice === "decline"}
                onChange={() => setChoice("decline")}
                className="accent-brand-600"
              />
              <span className="text-sm font-medium text-text-primary">ไม่ยอมรับ</span>
            </label>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!scrolledToEnd || !choice}
            className="w-full px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
