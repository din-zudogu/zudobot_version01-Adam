import Image from "next/image";

const nodes = [
  { x: 120, y: 120 },
  { x: 680, y: 90 },
  { x: 90, y: 420 },
  { x: 720, y: 460 },
  { x: 400, y: 60 },
  { x: 400, y: 540 },
  { x: 200, y: 300 },
  { x: 600, y: 300 },
];
const center = { x: 400, y: 300 };

const badges = ["PostgreSQL", "MongoDB", "Realtime AI", "Multi-Channel"];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-[#04060c] px-6 py-16">
      {/* Aurora background blobs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] animate-aurora rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[520px] w-[520px] animate-aurora-alt rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-220px] left-1/3 h-[480px] w-[480px] animate-aurora rounded-full bg-cyan-500/20 blur-3xl [animation-delay:-6s]" />

      {/* Connected AI network representing customer loyalty around the brand */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f6c453" />
          </linearGradient>
        </defs>
        {nodes.map((n, i) => (
          <line
            key={`line-${i}`}
            x1={n.x}
            y1={n.y}
            x2={center.x}
            y2={center.y}
            stroke="url(#lineGrad)"
            strokeWidth="1"
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={`node-${i}`}
            cx={n.x}
            cy={n.y}
            r="4"
            fill="#7dd3fc"
            style={{
              animation: `node-pulse ${3 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
        <circle
          cx={center.x}
          cy={center.y}
          r="7"
          fill="#f6c453"
          className="animate-glow"
        />
      </svg>

      {/* Content card */}
      <main className="animate-fade-up relative z-10 flex w-full max-w-xl flex-col items-center gap-7 rounded-3xl border border-white/10 bg-white/5 px-8 py-12 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-14 sm:py-16">
        <div className="animate-float">
          <Image
            src="/logo.png"
            alt="ZUDOBOT"
            width={96}
            height={96}
            priority
            className="rounded-2xl shadow-lg shadow-blue-500/20"
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-200/70">
            Welcome to
          </p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            AI Admin Chatbot
          </h1>
          <h2 className="gradient-text text-5xl font-extrabold tracking-tight sm:text-6xl">
            ZUDOBOT
          </h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
            <span>by</span>
            <Image
              src="/ZUDOGU_Logo.png"
              alt="zudogu"
              width={22}
              height={22}
              className="rounded-md"
            />
            <span className="font-semibold text-white">zudogu</span>
          </div>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-zinc-300 sm:text-base">
          ผู้ช่วย AI แอดมินอัจฉริยะที่ตอบลูกค้าอัตโนมัติตลอด 24 ชั่วโมง
          ช่วยสร้างความสัมพันธ์และ Brand Loyalty ให้ธุรกิจของคุณเติบโตอย่างยั่งยืน
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {badges.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <a
          href="https://zudobot.zudogu.com"
          className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-amber-400 px-8 text-base font-semibold text-[#04060c] shadow-lg shadow-blue-500/30 transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
        >
          เข้าสู่เว็บไซต์
        </a>
      </main>
    </div>
  );
}
