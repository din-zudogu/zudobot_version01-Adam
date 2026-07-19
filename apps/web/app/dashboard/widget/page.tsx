"use client";

import { useState, useEffect, useCallback } from "react";
import { ZudobotIntegration } from "@/components/widget/ZudobotIntegration";

interface WidgetConfig {
  embedKey:      string;
  widgetColor:   string;
  widgetPosition: "bottom-right" | "bottom-left";
  widgetEnabled: boolean;
  cdnBase:       string;
  version:       string;
}

const PRESET_COLORS = ["#1E5BC6","#16a34a","#dc2626","#9333ea","#0891b2","#ea580c","#1a1a2e","#B86B00"];

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function WidgetEmbedPage() {
  const [cfg, setCfg]         = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/tenant/me", { cache: "no-store" });
      const data = (await res.json()) as {
        tenantId?: string;
        profile?: {
          embedKey?: string;
          widgetColor?: string;
          widgetPosition?: "bottom-right" | "bottom-left";
          widgetEnabled?: boolean;
        };
        settings?: { widgetCdnBase?: string; widgetVersion?: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.error === "unauthorized"
            ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
            : "ไม่สามารถโหลดข้อมูล Widget ได้ (เซิร์ฟเวอร์ตอบกลับผิดพลาด)"
        );
      }

      if (!data.profile?.embedKey) {
        throw new Error("ไม่พบ embed key ของร้านค้า กรุณารีเฟรชหรือติดต่อผู้ดูแลระบบ");
      }

      setTenantId(data.tenantId ?? "");
      setCfg({
        embedKey: data.profile.embedKey,
        widgetColor: data.profile.widgetColor ?? "#1E5BC6",
        widgetPosition: data.profile.widgetPosition ?? "bottom-right",
        widgetEnabled: data.profile.widgetEnabled ?? false,
        cdnBase: data.settings?.widgetCdnBase ?? "https://cdn.zudogu.com/zudobot/v1",
        version: data.settings?.widgetVersion ?? "1.0.0",
      });
    } catch (err) {
      setCfg(null);
      const message =
        err instanceof TypeError && /fetch/i.test(String(err))
          ? "เชื่อมต่อ API ไม่ได้ (ตรวจสอบอินเทอร์เน็ต/DNS หรือลองรีเฟรชหน้า)"
          : err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดข้อมูลได้";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const set = useCallback(<K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) => {
    setCfg((p) => p ? { ...p, [k]: v } : p);
    setSaved(false);
  }, []);

  async function handleSave() {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/bot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetColor:    cfg.widgetColor,
          widgetPosition: cfg.widgetPosition,
          widgetEnabled:  cfg.widgetEnabled,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!cfg) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-red-500 text-sm">{loadError ?? "ไม่สามารถโหลดข้อมูลได้"}</p>
        <button
          type="button"
          onClick={() => void loadConfig()}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700"
        >
          ลองโหลดใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ZudobotIntegration tenantId={tenantId} embedKey={cfg.embedKey} />

      {/* Widget appearance — ไม่เกี่ยวกับการฝังสคริปต์ */}
      <div className="max-w-3xl">
      {/* Widget Config */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-5">
        <p className="text-sm font-semibold text-text-primary">Widget Settings</p>

        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary">เปิดใช้งาน Widget</p>
            <p className="text-xs text-text-muted mt-0.5">ปิด = บอทไม่แสดงบนเว็บไซต์</p>
          </div>
          <button
            type="button"
            onClick={() => set("widgetEnabled", !cfg.widgetEnabled)}
            className={[
              "relative w-11 h-6 rounded-full transition-colors duration-200",
              cfg.widgetEnabled ? "bg-brand-600" : "bg-gray-300",
            ].join(" ")}
          >
            <span className={[
              "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
              cfg.widgetEnabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")} />
          </button>
        </div>

        {/* Color */}
        <div>
          <p className="text-sm text-text-primary mb-2">สีหลัก Widget</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("widgetColor", c)}
                className={[
                  "w-7 h-7 rounded-full border-2 transition-transform",
                  cfg.widgetColor === c ? "border-brand-600 scale-110" : "border-transparent",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={cfg.widgetColor}
              onChange={(e) => set("widgetColor", e.target.value)}
              className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
              title="Custom color"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full border border-border-default" style={{ background: cfg.widgetColor }} />
            <span className="font-mono text-xs text-text-secondary">{cfg.widgetColor}</span>
          </div>
        </div>

        {/* Position */}
        <div>
          <p className="text-sm text-text-primary mb-2">ตำแหน่ง Widget</p>
          <div className="flex gap-3">
            {(["bottom-right","bottom-left"] as const).map((pos) => (
              <label
                key={pos}
                className={[
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-colors",
                  cfg.widgetPosition === pos
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-border-default text-text-secondary hover:border-brand-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="widgetPosition"
                  value={pos}
                  checked={cfg.widgetPosition === pos}
                  onChange={() => set("widgetPosition", pos)}
                  className="accent-brand-600"
                />
                {pos === "bottom-right" ? "ขวาล่าง" : "ซ้ายล่าง"}
              </label>
            ))}
          </div>
        </div>

        {/* Preview mini */}
        <div>
          <p className="text-xs text-text-muted mb-2">Preview</p>
          <div className="relative bg-surface-secondary rounded-xl h-28 border border-border-default overflow-hidden">
            <p className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-text-muted">เว็บไซต์ของคุณ</p>
            <div
              className={[
                "absolute bottom-3 w-11 h-11 rounded-full shadow-lg flex items-center justify-center text-white text-lg font-bold",
                cfg.widgetPosition === "bottom-right" ? "right-3" : "left-3",
              ].join(" ")}
              style={{ backgroundColor: cfg.widgetColor }}
            >
              💬
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-600 font-medium">✓ บันทึกแล้ว</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
