"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

const NAV = [
  { href: "/partner/overview",       icon: "▦",  label: "Overview" },
  { href: "/partner/clients",        icon: "👥", label: "Clients" },
  { href: "/partner/provision",      icon: "➕", label: "เพิ่มลูกค้า" },
  { href: "/partner/invite",         icon: "🔗", label: "Invite Client" },
  { href: "/partner/client-data",    icon: "🗂️", label: "ข้อมูลลูกค้า" },
  { href: "/partner/analytics",      icon: "📈", label: "Analytics" },
  { href: "/partner/billing",        icon: "📄", label: "Billing" },
  { href: "/partner/profile",        icon: "🪪",  label: "Partner Profile" },
  { href: "/partner/stripe-connect", icon: "💳", label: "Stripe Connect" },
];

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Sign out automatically if PartnerProfile has been deleted by admin
  useEffect(() => {
    if (pathname === "/partner/join" || pathname === "/partner/checkout") return;
    fetch("/api/partner/me").then((res) => {
      if (res.status === 403) signOut({ callbackUrl: "/login" });
    }).catch(() => {});
  }, [pathname]);

  // Join page is fully public — no sidebar
  if (pathname === "/partner/join" || pathname === "/partner/checkout") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-surface-secondary">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-surface-primary border-r border-border-default flex flex-col">
        <div className="px-4 py-4 border-b border-border-default">
          <ZudobotLogo size="sm" variant="color" />
          <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">Partner Portal</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
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
                ].join(" ")}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
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
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-6 bg-surface-primary border-b border-border-default flex-shrink-0">
          <span className="text-xs text-text-muted uppercase tracking-widest">
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? "Partner Portal"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-text-muted">partner_admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
