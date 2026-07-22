"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import { signOutWithCleanup } from "@/lib/auth/clientCookies";
import { useSyncPendingRegistration } from "@/lib/auth/useSyncPendingRegistration";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  master: "Master",
  enterprise: "Enterprise",
};

function getCookie(name: string): string | null {
  const match = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export default function NewUserPage() {
  const router = useRouter();
  const { session, status, role, phase, debug } = useSyncPendingRegistration();
  // Always resolves to something — either the specific package/plan the user
  // clicked through from, or the Trial fallback every unspecified signup
  // actually gets. This line is never blank.
  const [packageLabel, setPackageLabel] = useState<string>("Trial 14 วัน");
  const [isExplicitPackage, setIsExplicitPackage] = useState(false);

  const user = session?.user as { email?: string } | undefined;

  useEffect(() => {
    const next = getCookie("zudo-post-auth-next");
    if (!next) return;
    try {
      const params = new URLSearchParams(next.split("?")[1] ?? "");
      const pkgId = params.get("pkg");
      const planId = params.get("plan");
      if (pkgId) {
        fetch(`/api/checkout/validate?pkg=${pkgId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (json?.package?.name) {
              setPackageLabel(json.package.name);
              setIsExplicitPackage(true);
            }
          })
          .catch(() => {});
      } else if (planId) {
        setPackageLabel(PLAN_LABELS[planId] ?? planId);
        setIsExplicitPackage(true);
      }
    } catch {
      // malformed cookie — keep the default Trial label
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && role !== "pending") {
      router.replace("/auth/redirect");
    }
  }, [status, role, router]);

  if (status === "loading" || phase === "loading" || phase === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (role !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleExit() {
    await signOutWithCleanup(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com"
    );
  }

  function handleRegister() {
    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        <div className="card-premium p-8 text-center">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>

          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-3xl mx-auto mb-5">
            🔍
          </div>

          <h1 className="font-heading text-xl font-bold text-text-primary mb-2">
            ยังไม่พบบัญชีในระบบ
          </h1>

          {user?.email && (
            <div className="my-4 px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-default">
              <p className="text-xs text-text-muted mb-0.5">อีเมล</p>
              <p className="text-sm font-medium text-text-primary break-all">{user.email}</p>
            </div>
          )}

          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            อีเมล์นี้ยังไม่เคยมีการสมัครสมาชิก<br />
            ท่านต้องการสมัครตอนนี้หรือไม่?
          </p>

          <div className="mb-4 px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-200 text-sm text-brand-700">
            {isExplicitPackage
              ? <>คุณเข้ามาสมัครจากแพ็กเกจสำเร็จรูป: <strong>{packageLabel}</strong></>
              : <>ยังไม่ได้เลือกแพ็กเกจ/แผนใด — จะเริ่มต้นด้วย <strong>{packageLabel}</strong> (แพ็กเกจเริ่มต้น)</>}
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={handleRegister}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-brand"
            >
              สมัครใช้งาน
            </button>
            <button
              onClick={handleExit}
              className="w-full py-3 px-4 rounded-xl border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              ออกจากหน้าทำรายการ
            </button>
          </div>

          <p className="text-xs text-text-muted mt-6">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/login" className="text-brand-600 hover:underline">
              เข้าสู่ระบบด้วยอีเมลอื่น
            </Link>
          </p>

          {/* Temporary debug panel — remove once the pending→resolved
              redirect loop is confirmed fixed in production. */}
          <div className="mt-6 p-3 rounded-lg bg-gray-900 text-left">
            <pre className="text-[10px] text-lime-400 whitespace-pre-wrap break-all">
{JSON.stringify({ debug }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
