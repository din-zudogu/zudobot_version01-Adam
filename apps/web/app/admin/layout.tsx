"use client";

import Script from "next/script";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

type NavItem = { kind: "item"; href: string; icon: string; label: string };
type NavGroup = { kind: "group"; id: string; icon: string; label: string; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const NAV: NavEntry[] = [
  { kind: "item", href: "/admin/tenants",          icon: "👥", label: "Tenants" },
  { kind: "item", href: "/admin/partners",          icon: "🤝", label: "RAG Analytics" },
  { kind: "item", href: "/admin/zudobot-config",    icon: "🤖", label: "Bot Config (ตั้งค่าบอทกลาง)" },
  { kind: "item", href: "/admin/zudobot",           icon: "🛡️", label: "สิทธิ์ติดตั้ง Zudobot Embed" },
  { kind: "item", href: "/admin/admins",            icon: "🛡",  label: "Admins" },
  {
    kind: "group",
    id:    "cost-pricing",
    icon:  "🧮",
    label: "คำนวณราคาและต้นทุน",
    children: [
      { kind: "item", href: "/admin/cost-price",  icon: "📊", label: "Cost Price Scenarios" },
      { kind: "item", href: "/admin/vip-tenants", icon: "👑", label: "VIP Tenant" },
    ],
  },
  { kind: "item", href: "/admin/platform",     icon: "⚙️", label: "Platform Config" },
  { kind: "item", href: "/admin/knowledge",    icon: "📚", label: "Knowledge Base" },
  { kind: "item", href: "/admin/revenue",      icon: "📊", label: "Revenue" },
  { kind: "item", href: "/admin/centralized",  icon: "🗄",  label: "Big Data" },
  { kind: "item", href: "/admin/articles",     icon: "📝", label: "Delete Account" },
];

function allItems(nav: NavEntry[]): NavItem[] {
  return nav.flatMap((e) => (e.kind === "group" ? e.children : [e]));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const defaultOpen = () => {
    const s = new Set<string>();
    NAV.forEach((e) => {
      if (e.kind === "group" && e.children.some((c) => pathname.startsWith(c.href))) {
        s.add(e.id);
      }
    });
    return s;
  };
  const [openGroups, setOpenGroups] = useState<Set<string>>(defaultOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      NAV.forEach((e) => {
        if (e.kind === "group" && e.children.some((c) => pathname.startsWith(c.href))) {
          next.add(e.id);
        }
      });
      return next;
    });
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function isItemActive(href: string): boolean {
    return allItems(NAV)
      .filter((i) => pathname.startsWith(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href === href;
  }

  const topLabel =
    allItems(NAV)
      .filter((i) => pathname.startsWith(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Admin";

  const itemCls = (active: boolean, indent = false) =>
    [
      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
      indent ? "pl-7" : "",
      active
        ? "bg-brand-600 text-white shadow-sm"
        : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
    ].join(" ");

  const apiUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://zudobot.zudogu.com";
  const embedKey = process.env.NEXT_PUBLIC_PLATFORM_GLOBAL_EMBED_KEY || "";

  return (
    <div className="flex min-h-screen bg-surface-secondary">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-surface-primary border-r border-border-default flex flex-col">
        <div className="px-4 py-4 border-b border-border-default">
          <ZudobotLogo size="sm" variant="color" />
          <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">Admin Panel</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map((entry) => {
            if (entry.kind === "item") {
              return (
                <Link key={entry.href} href={entry.href} className={itemCls(isItemActive(entry.href))}>
                  <span className="text-base leading-none">{entry.icon}</span>
                  {entry.label}
                </Link>
              );
            }
            const isOpen      = openGroups.has(entry.id);
            const groupActive = entry.children.some((c) => isItemActive(c.href));
            return (
              <div key={entry.id}>
                <button
                  onClick={() => toggleGroup(entry.id)}
                  className={[
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    groupActive && !isOpen
                      ? "bg-brand-50 text-brand-700"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
                  ].join(" ")}
                >
                  <span className="text-base leading-none">{entry.icon}</span>
                  <span className="flex-1 text-left">{entry.label}</span>
                  <span className={`text-[10px] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {entry.children.map((child) => (
                      <Link key={child.href} href={child.href} className={itemCls(isItemActive(child.href), true)}>
                        <span className="text-base leading-none">{child.icon}</span>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-border-default">
          <p className="text-xs font-medium text-text-primary truncate">{session?.user?.name}</p>
          <p className="text-xs text-text-muted truncate mb-2">{session?.user?.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-text-muted hover:text-red-500 transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-6 bg-surface-primary border-b border-border-default flex-shrink-0">
          <span className="text-xs text-text-muted uppercase tracking-widest">{topLabel}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-text-muted">{(session?.user as { role?: string } | undefined)?.role}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* Zudobot Admin Widget */}
      <Script
        id="zudobot-admin-widget"
        src={`${apiUrl}/widget.js`}
        data-embed-key={embedKey}
        data-key={embedKey}
        data-api-url={apiUrl}
        data-position="bottom-right"
        strategy="afterInteractive"
      />
    </div>
  );
}