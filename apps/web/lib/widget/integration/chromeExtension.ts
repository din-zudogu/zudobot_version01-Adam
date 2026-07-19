/** Path 2 — Chrome Extension ID (ตั้งโดยทีม Zudobot บนเซิร์ฟเวอร์ ลูกค้าไม่ต้องรู้) */
export const CHROME_EXTENSION_ID =
  process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID?.trim() ?? "";

/** ลิงก์ร้าน Chrome ทั้งก้อน (ใช้ได้ก่อนมี Extension ID) */
export const CHROME_WEB_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL?.trim() ?? "";

export function chromeWebStoreUrl(extensionId: string): string {
  return `https://chromewebstore.google.com/detail/${extensionId}`;
}

export type ChromeExtensionMessage = {
  action: string;
  tenantId?: string;
  widgetId?: string;
};

export type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: ChromeExtensionMessage,
    callback: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

export function getChromeRuntime(): ChromeRuntime | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { chrome?: { runtime?: ChromeRuntime } };
  return w.chrome?.runtime ?? null;
}
