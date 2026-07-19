"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ActivateInner() {
  const params    = useSearchParams();
  const router    = useRouter();
  const sessionId = params.get("session_id") ?? "";
  const tenantId  = params.get("tenantId")   ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [msg,    setMsg]    = useState("");

  useEffect(() => {
    if (!sessionId) { setStatus("error"); setMsg("ไม่พบ session_id"); return; }
    fetch(`/api/partner/buy-for-client?session_id=${encodeURIComponent(sessionId)}&tenantId=${tenantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setStatus("success"); setTimeout(() => router.replace("/partner/clients"), 3000); }
        else       { setStatus("error"); setMsg(d.error ?? "activation_failed"); }
      })
      .catch(() => { setStatus("error"); setMsg("network_error"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (status === "loading") return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-muted">กำลังเปิดใช้งานแพ็กเกจให้ลูกค้า…</p>
    </div>
  );

  if (status === "success") return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-4">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-bold text-text-primary">เปิดใช้งานแพ็กเกจสำเร็จ</h2>
      <p className="text-sm text-text-muted">กำลังพาไปหน้า Clients…</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-4">
      <div className="text-5xl">❌</div>
      <h2 className="text-xl font-bold text-text-primary">เกิดข้อผิดพลาด</h2>
      <p className="text-sm text-red-600">{msg}</p>
      <a href="/partner/clients" className="text-sm text-brand-600 underline">กลับไปหน้า Clients</a>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ActivateInner />
    </Suspense>
  );
}
