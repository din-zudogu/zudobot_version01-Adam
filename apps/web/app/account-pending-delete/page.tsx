"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

export default function AccountPendingDeletePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user as {
    email?: string;
    pendingDeleteAt?: string;
    deletedByAdmin?: boolean;
  } | undefined;

  const deletedByAdmin = user?.deletedByAdmin ?? false;
  const deletionDate   = user?.pendingDeleteAt ? new Date(user.pendingDeleteAt) : null;
  const deletionDateThai = deletionDate
    ? deletionDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    : "ไม่ทราบ";

  async function handleRecover() {
    setRecovering(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/account/recover", { method: "POST" });
      if (!res.ok) throw new Error("recover_failed");
      await update();
      router.replace("/dashboard/overview");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setRecovering(false);
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        <div className="card-premium p-8 text-center">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>

          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-3xl mx-auto mb-5">
            {deletedByAdmin ? "🔒" : "⏳"}
          </div>

          <h1 className="font-heading text-xl font-bold text-text-primary mb-2">
            {deletedByAdmin ? "บัญชีถูกระงับการใช้งาน" : "บัญชีอยู่ระหว่างรอลบถาวร"}
          </h1>

          {user?.email && (
            <p className="text-sm text-text-muted mb-4 break-all">{user.email}</p>
          )}

          <div className={`px-4 py-3 rounded-xl mb-6 text-left border ${
            deletedByAdmin
              ? "bg-red-50 border-red-200"
              : "bg-orange-50 border-orange-200"
          }`}>
            {deletedByAdmin ? (
              <>
                <p className="text-sm text-red-800 leading-relaxed font-medium">
                  บัญชีของคุณถูกระงับโดยแอดมิน
                </p>
                <p className="text-sm text-red-700 leading-relaxed mt-1">
                  ข้อมูลทั้งหมดจะถูกลบถาวรในวันที่{" "}
                  <span className="font-semibold">{deletionDateThai}</span>
                </p>
                <p className="text-xs text-red-600 mt-2">
                  กรุณาติดต่อแอดมินหากต้องการกู้คืนบัญชี
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-orange-800 leading-relaxed">
                  คุณได้ร้องขอลบบัญชีนี้ไว้แล้ว ข้อมูลทั้งหมดจะถูกลบถาวรในวันที่{" "}
                  <span className="font-semibold">{deletionDateThai}</span>
                </p>
                <p className="text-xs text-orange-700 mt-1.5">
                  หากต้องการยกเลิก สามารถกู้คืนบัญชีได้ก่อนวันดังกล่าว
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Only show self-recover button if this was NOT admin-initiated */}
            {!deletedByAdmin && (
              <button
                onClick={handleRecover}
                disabled={recovering}
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
              >
                {recovering ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังกู้คืน...
                  </span>
                ) : (
                  "กู้คืนบัญชี (Recover Account)"
                )}
              </button>
            )}
            <button
              onClick={handleSignOut}
              disabled={recovering}
              className="w-full py-3 px-4 rounded-xl border border-border-default text-sm font-medium text-text-muted hover:bg-surface-secondary transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
