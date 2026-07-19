import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { resolveWidgetScriptIntegrity } from "@/lib/widget/resolveWidgetScriptIntegrity";

let cachedDiskIntegrity: string | undefined;

/** คำนวณ sha384 จาก public/widget.js (เมื่อ env ยังไม่ตั้ง) */
function integrityFromWidgetFile(): string {
  if (cachedDiskIntegrity !== undefined) return cachedDiskIntegrity;
  try {
    const filePath = path.join(process.cwd(), "public", "widget.js");
    if (!existsSync(filePath)) {
      cachedDiskIntegrity = "";
      return "";
    }
    const hash = createHash("sha384")
      .update(readFileSync(filePath))
      .digest("base64");
    cachedDiskIntegrity = `sha384-${hash}`;
    return cachedDiskIntegrity;
  } catch {
    cachedDiskIntegrity = "";
    return "";
  }
}

/**
 * Server API — NEXT_PUBLIC_* → WIDGET_SCRIPT_INTEGRITY → คำนวณจากไฟล์ widget.js
 */
export function resolveWidgetScriptIntegrityForServer(prop?: string): string {
  const fromClientEnv = resolveWidgetScriptIntegrity(prop);
  if (fromClientEnv) return fromClientEnv;

  const serverEnv = process.env.WIDGET_SCRIPT_INTEGRITY?.trim();
  if (serverEnv) return serverEnv;

  return integrityFromWidgetFile();
}
