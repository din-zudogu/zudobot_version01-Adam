"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router  = useRouter();
  const [busy,  setBusy] = useState(false);

  const imp = (session?.user as unknown as { impersonating?: { clientName: string; partnerId: string; expiresAt: number } } | null)?.impersonating;

  if (!imp) return null;

  async function handleBack() {
    setBusy(true);
    try {
      await update({ action: "deimpersonate" });
      router.replace("/partner/clients");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99998] bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-3 py-2.5 px-4">
      <span>
        กำลังดูในฐานะ <span className="font-bold">{imp.clientName}</span>
      </span>
      <button
        onClick={handleBack}
        disabled={busy}
        className="px-3 py-1 rounded-lg bg-white text-indigo-700 font-semibold text-xs hover:bg-indigo-50 transition-colors disabled:opacity-60"
      >
        {busy ? "กำลังออก…" : "← กลับหน้า Partner"}
      </button>
    </div>
  );
}
