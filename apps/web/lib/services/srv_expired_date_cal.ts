/**
 * srv_expired_date_cal — Zudobot Expiry Date Calculator Service
 *
 * Two-way calculation:
 *   Mode A: startDate + durationDays → endDate   (when durationDays provided)
 *   Mode B: startDate + endDate      → durationDays (when endDate provided)
 *
 * Usage:
 *   import { srv_expired_date_cal } from "@/lib/services/srv_expired_date_cal";
 *
 *   // Mode A — กรอกจำนวนวัน → คำนวณวันหมดอายุ
 *   const { endDate } = srv_expired_date_cal({ startDate: new Date(), durationDays: 30 });
 *
 *   // Mode B — กรอกวันหมดอายุ → คำนวณจำนวนวัน
 *   const { durationDays } = srv_expired_date_cal({ startDate: new Date(), endDate: "2026-12-31" });
 */

export interface SrvExpiredDateCalInput {
  startDate: Date | string;
  durationDays?: number;
  endDate?: Date | string;
}

export interface SrvExpiredDateCalResult {
  startDate: Date;
  endDate: Date;
  durationDays: number;
  isValid: boolean;
  error?: string;
}

export function srv_expired_date_cal(input: SrvExpiredDateCalInput): SrvExpiredDateCalResult {
  const start = new Date(input.startDate);
  start.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime())) {
    const fallback = new Date();
    return { startDate: fallback, endDate: fallback, durationDays: 0, isValid: false, error: "วันที่เริ่มต้นไม่ถูกต้อง" };
  }

  // Mode A: startDate + durationDays → endDate
  if (input.durationDays !== undefined) {
    const days = Math.floor(input.durationDays);
    if (!Number.isFinite(days) || days <= 0) {
      return { startDate: start, endDate: start, durationDays: 0, isValid: false, error: "จำนวนวันต้องเป็นตัวเลขจำนวนเต็มบวก" };
    }
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    return { startDate: start, endDate: end, durationDays: days, isValid: true };
  }

  // Mode B: startDate + endDate → durationDays
  if (input.endDate !== undefined) {
    const end = new Date(input.endDate);
    end.setHours(0, 0, 0, 0);
    if (isNaN(end.getTime())) {
      return { startDate: start, endDate: start, durationDays: 0, isValid: false, error: "วันที่สิ้นสุดไม่ถูกต้อง" };
    }
    if (end.getTime() <= start.getTime()) {
      return { startDate: start, endDate: end, durationDays: 0, isValid: false, error: "วันที่สิ้นสุดต้องหลังวันที่เริ่มต้น" };
    }
    const ms   = end.getTime() - start.getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    return { startDate: start, endDate: end, durationDays: days, isValid: true };
  }

  return { startDate: start, endDate: start, durationDays: 0, isValid: false, error: "ต้องระบุ durationDays หรือ endDate" };
}

/** Format Date → "YYYY-MM-DD" for <input type="date"> */
export function dateToInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Format Date → Thai short date, e.g. "15 มิ.ย. 2569" */
export function formatDateTH(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

/** Days remaining from today (negative = expired) */
export function daysRemaining(endDate: Date | string | null | undefined): number {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Compute "active" | "expired" | "suspended" from record fields */
export function computeVipStatus(
  isActive: boolean,
  endDate: Date | string | null | undefined,
): "active" | "expired" | "suspended" {
  if (!isActive) return "suspended";
  if (!endDate) return "active";
  return daysRemaining(endDate) > 0 ? "active" : "expired";
}
