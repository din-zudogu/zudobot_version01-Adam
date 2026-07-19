"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHROME_EXTENSION_ID,
  CHROME_WEB_STORE_URL,
  chromeWebStoreUrl,
  getChromeRuntime,
} from "@/lib/widget/integration/chromeExtension";

type ExtCheckResponse = { installed?: boolean; version?: string };
type OAuthResponse = {
  success?: boolean;
  ok?: boolean;
  error?: string;
  email?: string;
};

const STEPS_NOT_INSTALLED = [
  "ใช้เบราว์เซอร์ Google Chrome (คอมหรือมือถือ Android)",
  "กดปุ่มสีดำด้านล่าง → เปิดหน้า Chrome Web Store",
  "กด「เพิ่มใน Chrome」หรือ Add to Chrome → ยืนยัน",
  "กลับมาหน้านี้ แล้วกดปุ่ม「เชื่อมต่อบัญชี」",
  "เปิดเว็บร้านของคุณ (โดเมนที่ตั้งใน Allowed Domain)",
  "คลิกไอคอน Zudobot มุมขวาบน Chrome → กด「ฝังสคริปต์บนแท็บนี้」",
] as const;

const STEPS_INSTALLED = [
  "กดปุ่ม「เชื่อมต่อบัญชี」ด้านล่าง (ล็อกอิน Google ครั้งเดียว)",
  "เปิดเว็บร้านของคุณในแท็บใหม่",
  "คลิกไอคอน Zudobot ที่แถบ Chrome",
  "กด「ฝังสคริปต์บนแท็บนี้」— เสร็จ ไม่ต้องแก้โค้ดเว็บ",
] as const;

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-secondary">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function ChromeExtensionInstall() {
  const extensionId = CHROME_EXTENSION_ID;
  const storeUrl = extensionId
    ? chromeWebStoreUrl(extensionId)
    : CHROME_WEB_STORE_URL;

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notChrome, setNotChrome] = useState(false);

  const extensionReady = Boolean(extensionId || CHROME_WEB_STORE_URL);

  const checkExtension = useCallback(() => {
    if (!extensionId) {
      setInstalled(false);
      return;
    }

    const runtime = getChromeRuntime();
    if (!runtime?.sendMessage) {
      setNotChrome(true);
      setInstalled(false);
      return;
    }
    setNotChrome(false);

    try {
      runtime.sendMessage(
        extensionId,
        { action: "CHECK_EXTENSION_INSTALLED" },
        (response: unknown) => {
          const err = runtime.lastError?.message;
          if (err) {
            setInstalled(false);
            return;
          }
          const res = response as ExtCheckResponse | undefined;
          setInstalled(!!res?.installed);
        }
      );
    } catch {
      setInstalled(false);
    }
  }, [extensionId]);

  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  function openWebStore() {
    if (!storeUrl) return;
    window.open(storeUrl, "_blank", "noopener,noreferrer");
  }

  function triggerExtensionAuth() {
    if (!extensionId) {
      setError("ยังเปิดให้ติดตั้งอัตโนมัติไม่ได้ชั่วคราว — ใช้วิธีคัดลอกโค้ดด้านล่างแทน");
      return;
    }

    const runtime = getChromeRuntime();
    if (!runtime?.sendMessage) {
      setError("กรุณาเปิดหน้านี้ใน Google Chrome แล้วติดตั้ง Extension ก่อน");
      return;
    }

    setConnecting(true);
    setError(null);

    runtime.sendMessage(
      extensionId,
      { action: "TRIGGER_OAUTH" },
      (response: unknown) => {
        setConnecting(false);
        const err = runtime.lastError?.message;
        if (err) {
          setError("ยังไม่พบ Extension — กดดาวน์โหลดก่อน แล้วลองใหม่");
          setConnected(false);
          return;
        }
        const res = response as OAuthResponse | undefined;
        if (res?.success || res?.ok) {
          setConnected(true);
          setError(null);
        } else {
          setConnected(false);
          setError("เชื่อมต่อไม่สำเร็จ ลองล็อกอิน Google อีกครั้ง");
        }
      }
    );
  }

  return (
    <div className="bg-surface-primary border border-border-default rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">
          วิธีที่ 1 — ติดตั้งอัตโนมัติ (แนะนำ)
        </p>
        <p className="text-xs text-text-muted mt-1">
          ใช้ปลั๊กอิน Chrome ช่วยฝังบอทให้ — ไม่ต้องเขียนโค้ด ไม่ต้องอัปโหลดไฟล์
        </p>
      </div>

      {!extensionReady ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <p className="text-xs text-amber-900 font-medium">
            ตัวช่วย Chrome กำลังเปิดให้บริการเร็วๆ นี้
          </p>
          <p className="text-xs text-amber-800">
            ตอนนี้ให้ใช้「วิธีที่ 2 — คัดลอกโค้ด」ด้านล่างแทนได้เลย ใช้งานได้ทันที
          </p>
        </div>
      ) : (
        <>
          <StepList steps={installed ? STEPS_INSTALLED : STEPS_NOT_INSTALLED} />

          {notChrome && (
            <p className="text-xs text-amber-700">
              คุณไม่ได้ใช้ Chrome — ให้เปิดลิงก์นี้ใน Chrome หรือใช้วิธีคัดลอกโค้ดด้านล่าง
            </p>
          )}

          {installed === null ? (
            <p className="text-xs text-text-muted">กำลังตรวจว่าติดตั้ง Extension แล้วหรือยัง...</p>
          ) : !installed ? (
            <button
              type="button"
              onClick={openWebStore}
              disabled={!storeUrl}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              ขั้นที่ 1 — ดาวน์โหลดจาก Chrome Web Store
            </button>
          ) : (
            <button
              type="button"
              id="ext-status-btn"
              disabled={connecting || !extensionId}
              onClick={triggerExtensionAuth}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {connecting
                ? "กำลังเชื่อมต่อ..."
                : connected
                  ? "✓ เชื่อมต่อแล้ว — ไปเปิดเว็บร้าน แล้วกดไอคอน Extension"
                  : "ขั้นที่ 2 — เชื่อมต่อบัญชี Zudobot"}
            </button>
          )}

          {installed && !extensionId && (
            <p className="text-xs text-text-muted">
              หลังติดตั้งแล้ว เปิดเว็บร้าน → คลิกไอคอน Zudobot → ฝังสคริปต์
            </p>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
