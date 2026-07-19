"use client";

import type { SandboxScenario } from "./scenarios";

interface Props {
  scenario: SandboxScenario;
}

// Mock website layouts keyed by scenario id
function MockFashion({ s }: { s: SandboxScenario }) {
  return (
    <div className="h-full flex flex-col bg-white font-sans text-sm overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <span className="font-bold text-base" style={{ color: s.themeColor }}>
          {s.mockBusiness.name}
        </span>
        <div className="flex gap-4 text-gray-500 text-xs">
          <span>New In</span><span>Women</span><span>Sale</span>
        </div>
      </nav>
      {/* Hero */}
      <div className="relative flex-shrink-0 h-40 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${s.themeColor}18, ${s.accentColor}18)` }}>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">New Collection</p>
          <h1 className="text-xl font-bold text-gray-800">{s.mockBusiness.tagline}</h1>
          <button className="mt-2 text-xs px-4 py-1.5 rounded-full text-white font-medium"
            style={{ background: s.themeColor }}>
            Shop Now
          </button>
        </div>
      </div>
      {/* Products */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Best Sellers</p>
        <div className="grid grid-cols-3 gap-2">
          {s.mockBusiness.items.slice(0, 3).map((item, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-gray-100">
              <div className="h-16 flex items-center justify-center text-2xl"
                style={{ background: `${s.themeColor}10` }}>
                👗
              </div>
              <div className="p-1.5">
                <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                <p className="text-xs font-bold" style={{ color: s.themeColor }}>{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockGadget({ s }: { s: SandboxScenario }) {
  return (
    <div className="h-full flex flex-col bg-gray-950 text-white text-sm overflow-hidden">
      <nav className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
        <span className="font-bold text-base" style={{ color: s.accentColor }}>{s.mockBusiness.name}</span>
        <div className="flex gap-3 text-gray-400 text-xs">
          <span>Phones</span><span>Laptops</span><span>Deals</span>
        </div>
      </nav>
      <div className="relative flex-shrink-0 px-5 py-5"
        style={{ background: `linear-gradient(135deg, ${s.themeColor}22, #0a0a1a)` }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: s.accentColor }}>
          {s.mockBusiness.tagline}
        </p>
        <p className="text-gray-300 text-xs max-w-xs">สินค้าของแท้ รับประกัน มีหน้าร้าน</p>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Hot Deals</p>
        <div className="space-y-2">
          {s.mockBusiness.items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-900 border border-gray-800">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${s.themeColor}20` }}>📱</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 truncate">{item.desc}</p>
              </div>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: s.accentColor }}>{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockSoftware({ s }: { s: SandboxScenario }) {
  return (
    <div className="h-full flex flex-col bg-white text-sm overflow-hidden">
      <nav className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <span className="font-bold text-base" style={{ color: s.themeColor }}>{s.mockBusiness.name}</span>
        <div className="flex gap-3 text-gray-500 text-xs">
          <span>Features</span><span>Pricing</span><span>Docs</span>
        </div>
      </nav>
      <div className="flex-shrink-0 px-6 py-6 text-center"
        style={{ background: `linear-gradient(135deg, ${s.themeColor}08, ${s.accentColor}08)` }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: s.themeColor }}>
          {s.mockBusiness.tagline}
        </p>
        <div className="flex justify-center gap-2 mt-2">
          <button className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ background: s.themeColor }}>ทดลองฟรี</button>
          <button className="text-xs px-3 py-1.5 rounded-lg border text-gray-600"
            style={{ borderColor: s.themeColor }}>ดู Demo</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          {s.mockBusiness.items.slice(0, 4).map((item, i) => (
            <div key={i} className="p-2.5 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-0.5">{item.name}</p>
              <p className="text-xs font-bold" style={{ color: s.themeColor }}>{item.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockHotel({ s }: { s: SandboxScenario }) {
  return (
    <div className="h-full flex flex-col bg-stone-50 text-sm overflow-hidden font-serif">
      <nav className="flex items-center justify-between px-6 py-3 bg-white border-b border-stone-200 flex-shrink-0">
        <span className="font-bold text-base tracking-wide" style={{ color: s.themeColor }}>{s.mockBusiness.name}</span>
        <div className="flex gap-3 text-stone-400 text-xs">
          <span>Rooms</span><span>Dining</span><span>Spa</span>
        </div>
      </nav>
      <div className="relative flex-shrink-0 h-36 flex flex-col items-center justify-center"
        style={{ background: `linear-gradient(160deg, ${s.themeColor}25, ${s.accentColor}15)` }}>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400 mb-1">Welcome to</p>
        <h1 className="text-lg font-bold tracking-wide" style={{ color: s.themeColor }}>{s.mockBusiness.name}</h1>
        <p className="text-xs text-stone-500 mt-1">{s.mockBusiness.tagline}</p>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-3">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">Our Rooms</p>
        <div className="space-y-2">
          {s.mockBusiness.items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛏</span>
                <div>
                  <p className="text-xs font-semibold text-stone-700">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.desc}</p>
                </div>
              </div>
              <p className="text-xs font-bold" style={{ color: s.themeColor }}>{item.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockRestaurant({ s }: { s: SandboxScenario }) {
  return (
    <div className="h-full flex flex-col bg-amber-50 text-sm overflow-hidden">
      <nav className="flex items-center justify-between px-5 py-3 bg-white border-b border-amber-100 flex-shrink-0">
        <span className="font-bold text-base" style={{ color: s.themeColor }}>{s.mockBusiness.name}</span>
        <div className="flex gap-3 text-amber-600 text-xs">
          <span>เมนู</span><span>จอง</span><span>เดลิเวอรี่</span>
        </div>
      </nav>
      <div className="flex-shrink-0 px-5 py-4 text-center"
        style={{ background: `linear-gradient(135deg, ${s.themeColor}15, ${s.accentColor}10)` }}>
        <p className="text-base font-bold" style={{ color: s.themeColor }}>{s.mockBusiness.tagline}</p>
        <p className="text-xs text-amber-700 mt-0.5">อร่อยถึงใจ ส่งถึงบ้าน</p>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-3">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">🍜 เมนูแนะนำ</p>
        <div className="grid grid-cols-2 gap-2">
          {s.mockBusiness.items.slice(0, 4).map((item, i) => (
            <div key={i} className="rounded-xl bg-white border border-amber-100 overflow-hidden">
              <div className="h-14 flex items-center justify-center text-2xl"
                style={{ background: `${s.themeColor}10` }}>🍽</div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                <p className="text-xs font-bold" style={{ color: s.themeColor }}>{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MOCK_COMPONENTS: Record<string, React.ComponentType<{ s: SandboxScenario }>> = {
  fashion: MockFashion,
  gadget: MockGadget,
  software: MockSoftware,
  hotel: MockHotel,
  restaurant: MockRestaurant,
};

export function WebsitePreview({ scenario }: Props) {
  const MockLayout = MOCK_COMPONENTS[scenario.id] ?? MockFashion;

  return (
    <div className="relative h-full rounded-2xl overflow-hidden border border-border-default shadow-card">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-secondary border-b border-border-default flex-shrink-0">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3 bg-surface-primary rounded-md px-3 py-1 text-xs text-text-muted border border-border-default truncate">
          {scenario.mockBusiness.name.toLowerCase().replace(/\s/g, "")}.com
        </div>
        <span className="text-xs text-text-muted hidden sm:block">Preview</span>
      </div>

      {/* Mock website */}
      <div className="relative" style={{ height: "calc(100% - 44px)" }}>
        <MockLayout s={scenario} />

        {/* Zudobot widget bubble */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-none select-none">
          <div
            className="px-3 py-2 rounded-2xl rounded-br-sm text-xs text-white max-w-[160px] shadow-lg animate-fade-in"
            style={{ background: scenario.themeColor }}
          >
            {scenario.greeting}
          </div>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
            style={{ background: scenario.themeColor }}
          >
            {scenario.icon}
          </div>
        </div>

        {/* Zudobot badge */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-border-default rounded-full px-2.5 py-1 shadow-sm pointer-events-none select-none">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-text-muted font-medium">Powered by Zudobot</span>
        </div>
      </div>
    </div>
  );
}
