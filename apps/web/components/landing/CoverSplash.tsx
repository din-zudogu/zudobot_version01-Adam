"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import logoSrc from "../../public/logo.png";

const DISMISS_KEY = "zudobot_cover_dismissed";

export function CoverSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(DISMISS_KEY);
    if (!alreadySeen) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [visible]);

  if (!visible) return null;

  function handleEnter() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setLeaving(true);
    setTimeout(() => setVisible(false), 500);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Zudobot"
      className={`fixed inset-0 z-[200] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Base gradient — animated pan */}
      <div
        className="absolute inset-0 animate-gradient-pan"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #07101F 0%, #0D2D6B 35%, #163F8A 60%, #0D1829 100%)",
          backgroundSize: "220% 220%",
        }}
      />

      {/* Soft glowing blobs */}
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-brand-500/30 blur-3xl animate-blob" />
      <div
        className="absolute -bottom-32 -right-16 w-[480px] h-[480px] rounded-full bg-gold-500/20 blur-3xl animate-blob"
        style={{ animationDelay: "4s" }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-500/20 blur-3xl animate-blob"
        style={{ animationDelay: "8s" }}
      />

      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Floating loyalty / AI motifs */}
      <FloatingIcon className="top-[14%] left-[10%]" delay="0s" size={34}>
        <ChatBubbleIcon />
      </FloatingIcon>
      <FloatingIcon className="top-[22%] right-[12%]" delay="1.2s" size={28}>
        <HeartIcon />
      </FloatingIcon>
      <FloatingIcon className="bottom-[20%] left-[15%]" delay="2.4s" size={26}>
        <SparkleIcon />
      </FloatingIcon>
      <FloatingIcon className="bottom-[16%] right-[16%]" delay="0.8s" size={32}>
        <ChatBubbleIcon />
      </FloatingIcon>
      <FloatingIcon className="top-[45%] left-[6%]" delay="3.2s" size={22}>
        <SparkleIcon />
      </FloatingIcon>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center animate-fade-in-up">
        {/* Logo pair */}
        <div className="flex items-center gap-4 mb-8">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-3 shadow-brand animate-float">
            <Image src={logoSrc} alt="Zudobot" width={56} height={56} priority />
          </div>
          <span className="text-white/40 text-2xl font-light">×</span>
          <div
            className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-3 shadow-gold animate-float"
            style={{ animationDelay: "0.6s" }}
          >
            <Image
              src="/ZUDOGU_Logo.png"
              alt="Zudogu"
              width={56}
              height={56}
            />
          </div>
        </div>

        <p className="text-white/60 text-xs md:text-sm uppercase tracking-[0.25em] mb-4">
          AI Admin Chatbot Platform
        </p>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-6xl text-white leading-tight mb-3">
          Welcome to AI Admin Chatbot
          <br />
          <span className="bg-grad-gold bg-clip-text text-transparent">ZUDOBOT</span>
          <span className="text-white"> by </span>
          <span className="bg-grad-cyan bg-clip-text text-transparent">ZUDOGU</span>
        </h1>

        <p className="text-white/70 text-sm md:text-lg max-w-xl mb-10">
          นวัตกรรม AI ที่ช่วยให้ธุรกิจของคุณดูแลลูกค้าได้ตลอด 24 ชั่วโมง
          พร้อมสร้าง Brand Loyalty ที่แข็งแกร่งในทุกบทสนทนา
        </p>

        <button
          onClick={handleEnter}
          className="group inline-flex items-center gap-2 bg-grad-gold text-white font-heading font-bold text-base md:text-lg px-8 py-4 rounded-xl shadow-gold hover:scale-105 transition-transform duration-300"
        >
          เข้าสู่เว็บไซต์
        </button>
      </div>
    </div>
  );
}

function FloatingIcon({
  className,
  delay,
  size,
  children,
}: {
  className: string;
  delay: string;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute text-white/25 animate-float ${className}`}
      style={{ animationDelay: delay, width: size, height: size }}
    >
      {children}
    </div>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H9l-4.4 3.3A1 1 0 013 19.5V16H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 21s-7.2-4.6-9.8-9C.6 8.8 1.6 5 5 4a5.5 5.5 0 017 1.6A5.5 5.5 0 0119 4c3.4 1 4.4 4.8 2.8 8-2.6 4.4-9.8 9-9.8 9z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}
