"use client";

import { useState, useEffect } from "react";
import { DeleteAccountModal } from "@/components/dashboard/DeleteAccountModal";

interface UserInfo { name: string; email: string; hasPassword: boolean }

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AccountPage() {
  const [user, setUser]           = useState<UserInfo | null>(null);
  const [name, setName]           = useState("");
  const [loading, setLoading]     = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [curPwd, setCurPwd]       = useState("");
  const [newPwd, setNewPwd]       = useState("");
  const [confPwd, setConfPwd]     = useState("");

  const [profileSaving, setPS]    = useState(false);
  const [profileSaved, setPS2]    = useState(false);
  const [profileError, setPE]     = useState<string | null>(null);

  const [pwdSaving, setPwdS]      = useState(false);
  const [pwdSaved, setPwdS2]      = useState(false);
  const [pwdError, setPwdE]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d) => {
        setUser({ name: d.user?.name ?? "", email: d.user?.email ?? "", hasPassword: d.user?.hasPassword ?? false });
        setName(d.user?.name ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function saveName() {
    setPE(null);
    setPS(true);
    try {
      const res = await fetch("/api/tenant/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setUser((u) => u ? { ...u, name } : u);
      setPS2(true);
      setTimeout(() => setPS2(false), 3000);
    } catch {
      setPE("บันทึกไม่สำเร็จ");
    } finally {
      setPS(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdE(null);
    if (newPwd !== confPwd) { setPwdE("รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    if (newPwd.length < 8)  { setPwdE("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setPwdS(true);
    try {
      const res = await fetch("/api/tenant/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          wrong_password:           "รหัสผ่านปัจจุบันไม่ถูกต้อง",
          current_password_required:"กรุณากรอกรหัสผ่านปัจจุบัน",
          password_too_short:       "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
        };
        throw new Error(msgs[data.error] ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
      setCurPwd(""); setNewPwd(""); setConfPwd("");
      setPwdS2(true);
      setTimeout(() => setPwdS2(false), 3000);
    } catch (err) {
      setPwdE(err instanceof Error ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setPwdS(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Account</h1>
        <p className="text-sm text-text-muted mt-0.5">จัดการข้อมูลส่วนตัวและรหัสผ่าน</p>
      </div>

      {/* Profile Section */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <p className="text-sm font-bold text-text-primary">ข้อมูลส่วนตัว</p>

        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">ชื่อ</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setPS2(false); }}
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">อีเมล</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-muted cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">อีเมลไม่สามารถเปลี่ยนแปลงได้</p>
        </div>

        {profileError && <p className="text-sm text-red-500">{profileError}</p>}
        <div className="flex items-center justify-end gap-3">
          {profileSaved && <span className="text-xs text-green-600 font-medium">✓ บันทึกแล้ว</span>}
          <button
            onClick={saveName}
            disabled={profileSaving || name === user?.name}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {profileSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="bg-surface-primary border border-red-200 rounded-2xl p-6">
        <p className="text-sm font-bold text-red-600 mb-1">Danger Zone</p>
        <p className="text-sm text-text-muted mb-4">
          ลบบัญชีและข้อมูลทั้งหมดออกจากระบบ — ดำเนินการด้วยความระมัดระวัง
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-5 py-2.5 rounded-xl border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 text-sm font-semibold transition-colors"
        >
          Delete Account
        </button>
      </div>

      {/* Password Section */}
      {user?.hasPassword ? (
        <form onSubmit={changePassword} className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
          <p className="text-sm font-bold text-text-primary">เปลี่ยนรหัสผ่าน</p>

          {[
            { label: "รหัสผ่านปัจจุบัน", value: curPwd, set: setCurPwd },
            { label: "รหัสผ่านใหม่ (≥ 8 ตัวอักษร)", value: newPwd, set: setNewPwd },
            { label: "ยืนยันรหัสผ่านใหม่", value: confPwd, set: setConfPwd },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
              <input
                type="password"
                value={value}
                onChange={(e) => { set(e.target.value); setPwdS2(false); }}
                required
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
              />
            </div>
          ))}

          {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
          <div className="flex items-center justify-end gap-3">
            {pwdSaved && <span className="text-xs text-green-600 font-medium">✓ เปลี่ยนรหัสผ่านแล้ว</span>}
            <button
              type="submit"
              disabled={pwdSaving}
              className="px-5 py-2.5 rounded-xl bg-surface-secondary border border-border-default hover:border-brand-400 text-text-secondary hover:text-brand-600 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {pwdSaving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-surface-primary border border-border-default rounded-2xl p-5">
          <p className="text-sm font-bold text-text-primary mb-1">รหัสผ่าน</p>
          <p className="text-sm text-text-muted">บัญชีนี้เข้าสู่ระบบผ่าน Google — ไม่มีรหัสผ่านแยกต่างหาก</p>
        </div>
      )}
    </div>
    </>
  );
}
