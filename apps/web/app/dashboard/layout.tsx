"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
import { useLang } from "@/lib/i18n";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_WARNING_MS = 25 * 60 * 1000;

// Nav items — keys map to i18n t("nav.*"). A item may carry `children` (submenu).
type NavLeaf  = { href: string; icon: string; key: string };
type NavGroup = { icon: string; key: string; children: NavLeaf[] };
type NavItem  = NavLeaf | NavGroup;

const isGroup = (n: NavItem): n is NavGroup => "children" in n;

const NAV: NavItem[] = [
  { href: "/dashboard/overview",      icon: "▦",  key: "nav.overview" },
  { href: "/dashboard/bot",           icon: "🤖", key: "nav.botConfig" },
  { href: "/dashboard/knowledge",     icon: "📚", key: "nav.knowledgeBase" },
  { href: "/dashboard/products",      icon: "🛍️", key: "nav.products" },
  { icon: "📄", key: "nav.documents", children: [
    { href: "/dashboard/documents/pdpa",  icon: "🔐", key: "nav.docPdpa" },
    { href: "/dashboard/documents/terms", icon: "📜", key: "nav.docTerms" },
  ]},
  { href: "/dashboard/live-chat",     icon: "💬", key: "nav.liveChat" },
  { href: "/dashboard/widget",        icon: "🔌", key: "nav.widgetEmbed" },
  { href: "/dashboard/channels",      icon: "📡", key: "nav.channels" },
  { href: "/dashboard/omni-chat",     icon: "🔀", key: "nav.omniChat" },
  { href: "/dashboard/analytics",     icon: "📈", key: "nav.analytics" },
  { href: "/dashboard/memory",        icon: "💾", key: "nav.memory" },
  { href: "/dashboard/notifications", icon: "🔔", key: "nav.lineNotifications" },
  { href: "/dashboard/billing",       icon: "💳", key: "nav.billing" },
  { href: "/dashboard/kyc",           icon: "🔖", key: "nav.kyc" },
  { href: "/dashboard/privacy",       icon: "🔒", key: "nav.privacy" },
  { href: "/dashboard/security",      icon: "🛡️", key: "nav.security" },
  { href: "/dashboard/account",       icon: "👤", key: "nav.account" },
  { href: "/dashboard/business",      icon: "🏢", key: "nav.business" },
];

const NAV_LEAVES: NavLeaf[] = NAV.flatMap((n) => (isGroup(n) ? n.children : [n]));

// ── Inner layout (has access to LangContext) ───────────────────────────────

function DashboardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLang();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeKey = NAV_LEAVES.find((n) => pathname.startsWith(n.href))?.key ?? "nav.overview";

  const resetTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    setShowTimeoutWarning(false);
    warningRef.current = setTimeout(() => setShowTimeoutWarning(true), SESSION_WARNING_MS);
    timeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/login?reason=timeout" });
    }, SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((e) => document.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetTimers));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [resetTimers]);

  return (
    <div className="flex min-h-screen bg-surface-secondary relative">
      <ImpersonationBanner />
      {/* Session timeout warning */}
      {showTimeoutWarning && (
        <div className="fixed top-0 left-0 right-0 z-[99999] bg-amber-500 text-white text-sm font-medium text-center py-2.5 px-4 flex items-center justify-center gap-3">
          <span>{t("session.warning")}</span>
          <button
            onClick={resetTimers}
            className="underline font-semibold hover:no-underline"
          >
            {t("session.renew")}
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`flex-shrink-0 border-r border-border-default flex flex-col transition-all duration-300
        bg-white dark:bg-slate-900
        ${sidebarCollapsed ? "md:w-16" : "md:w-56"}
        ${mobileMenuOpen
          ? "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl"
          : "hidden md:flex"
        }
        md:relative md:z-auto md:shadow-none`}>

        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-border-default flex items-center justify-between">
          {!sidebarCollapsed && <ZudobotLogo size="sm" variant="color" />}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-md hover:bg-surface-secondary transition-colors md:block hidden"
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-md hover:bg-surface-secondary transition-colors md:hidden"
          >
            ✕
          </button>
        </div>

        {/* Language switcher — top of nav */}
        <div className="px-2 pt-2 pb-1">
          <LanguageSwitcher collapsed={sidebarCollapsed} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            if (isGroup(item)) {
              const groupActive = item.children.some((c) => pathname.startsWith(c.href));
              return (
                <div key={item.key} className="pt-1">
                  {!sidebarCollapsed && (
                    <div className={`flex items-center gap-2.5 px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide ${
                      groupActive ? "text-brand-600" : "text-text-muted"
                    }`}>
                      <span className="text-base leading-none">{item.icon}</span>
                      <span>{t(item.key)}</span>
                    </div>
                  )}
                  <div className={sidebarCollapsed ? "space-y-0.5" : "space-y-0.5 pl-2"}>
                    {item.children.map((child) => {
                      const active = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={[
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                            active
                              ? "bg-brand-600 text-white shadow-sm"
                              : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
                            sidebarCollapsed ? "justify-center px-2" : "",
                          ].join(" ")}
                          title={sidebarCollapsed ? t(child.key) : undefined}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="text-base leading-none">{child.icon}</span>
                          {!sidebarCollapsed && <span>{t(child.key)}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
                  sidebarCollapsed ? "justify-center px-2" : "",
                ].join(" ")}
                title={sidebarCollapsed ? t(item.key) : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {!sidebarCollapsed && <span>{t(item.key)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-3 py-3 border-t border-border-default space-y-2">
          {/* User info + logout */}
          {!sidebarCollapsed && (
            <>
              <p className="text-xs font-semibold text-text-primary truncate px-1">{session?.user?.name}</p>
              <p className="text-xs text-text-muted truncate px-1 -mt-1">{session?.user?.email}</p>
            </>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-text-muted hover:text-red-500 transition-colors px-1"
          >
            {sidebarCollapsed ? "🚪" : t("sidebar.logout")}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-6 bg-surface-primary border-b border-border-default flex-shrink-0 gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-md hover:bg-surface-secondary transition-colors"
          >
            ☰
          </button>
          <span className="text-xs text-text-muted uppercase tracking-widest">
            {t(activeKey)}
          </span>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              {t("header.upgradePlan")} →
            </Link>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardInner>{children}</DashboardInner>;
}
