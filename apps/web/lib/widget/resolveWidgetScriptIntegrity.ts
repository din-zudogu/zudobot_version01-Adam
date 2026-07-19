/** แสดงเมื่อโค้ดยังโหลดไม่ได้ (รอ API หรือรอ deploy) */
export const EMBED_SCRIPT_LOADING_MESSAGE = "กำลังโหลดโค้ดติดตั้ง...";

export const EMBED_SCRIPT_NOT_READY_MESSAGE =
  "โค้ดยังไม่พร้อม — กดปุ่ม「โหลดโค้ดใหม่」หรือรอ 1–2 นาทีแล้วรีเฟรชหน้า หากยังไม่ขึ้น แจ้งทีมงาน Zudobot";

/** @deprecated ใช้ EMBED_SCRIPT_NOT_READY_MESSAGE */
export const EMBED_INTEGRITY_PROCESSING_MESSAGE = EMBED_SCRIPT_NOT_READY_MESSAGE;

/**
 * Client-safe — NEXT_PUBLIC_* only (no Node fs).
 * Server routes: use resolveWidgetScriptIntegrityForServer from ./resolveWidgetScriptIntegrity.server
 */
export function resolveWidgetScriptIntegrity(prop?: string): string {
  const fromProp = prop?.trim() ?? "";
  if (fromProp) return fromProp;
  return (
    process.env.NEXT_PUBLIC_ZUDOBOT_GLOBAL_WIDGET_SCRIPT_INTEGRITY?.trim() ||
    process.env.NEXT_PUBLIC_WIDGET_SCRIPT_INTEGRITY?.trim() ||
    ""
  );
}
