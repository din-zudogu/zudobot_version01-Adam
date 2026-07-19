"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Briefcase } from "lucide-react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import {
  getAutoRedirectPath,
  needsDualRoleSelect,
  type SessionUserRoles,
} from "@/lib/auth/roleSelect";

export default function SelectRolePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const user = session?.user as SessionUserRoles & { email?: string } | undefined;
    if (!user) return;

    if (user.role === "pending") {
      router.replace("/auth/redirect");
      return;
    }

    if (user.role === "super_admin" || user.role === "admin") {
      router.replace("/admin/tenants");
      return;
    }

    if (needsDualRoleSelect(user)) {
      setShowPicker(true);
      return;
    }

    const path = getAutoRedirectPath(user);
    if (path) router.replace(path);
  }, [status, session, router]);

  if (status === "loading" || !showPicker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const email = (session?.user as { email?: string } | undefined)?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="max-w-3xl w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <ZudobotLogo size="md" variant="color" />
          </div>
          <h2 className="text-3xl font-extrabold text-text-primary">เลือกพื้นที่การทำงาน</h2>
          <p className="mt-2 text-sm text-text-muted">
            บัญชีของคุณมีสิทธิ์เข้าถึงหลายส่วน กรุณาเลือกส่วนที่คุณต้องการเข้าใช้งาน
          </p>
          {email && (
            <p className="mt-2 text-xs text-text-muted truncate">{email}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <button
            type="button"
            onClick={() => router.replace("/partner/overview")}
            className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-brand-500 hover:bg-blue-50 transition-all group"
          >
            <Briefcase className="w-16 h-16 text-gray-400 group-hover:text-brand-600 mb-4" />
            <h3 className="text-xl font-bold text-text-primary group-hover:text-brand-600">
              Partner
            </h3>
            <p className="text-text-muted mt-2 text-center text-sm">
              เข้าสู่ระบบจัดการสำหรับพาร์ทเนอร์
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.replace("/dashboard/overview")}
            className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <Building2 className="w-16 h-16 text-gray-400 group-hover:text-emerald-600 mb-4" />
            <h3 className="text-xl font-bold text-text-primary group-hover:text-emerald-600">
              Tenant
            </h3>
            <p className="text-text-muted mt-2 text-center text-sm">
              เข้าสู่ระบบจัดการร้านค้าของคุณ
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
