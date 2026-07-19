/**
 * Returns UTC Date bounds for the current calendar day in Asia/Bangkok (ICT, UTC+7).
 * Used by global-chat-backup cron (scheduled 16:59 UTC ≈ 23:59 ICT).
 */
export function getBangkokDayBounds(now = new Date()): { startOfToday: Date; endOfToday: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year:      "numeric",
    month:     "2-digit",
    day:       "2-digit",
  }).formatToParts(now);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value);

  const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const startOfToday = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - BANGKOK_OFFSET_MS);
  const endOfToday   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - BANGKOK_OFFSET_MS);

  return { startOfToday, endOfToday };
}
