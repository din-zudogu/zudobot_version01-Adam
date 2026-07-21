/**
 * System-wide account audit log.
 * Durable trail (1-year TTL) of auth/bot_state/admin_action/payment events per email —
 * source of truth for the /admin/system-log page and for tracing what an admin
 * action (force logout, clear cache, suspend, ...) actually did.
 */
import { connectDB } from "@/lib/db/connect";
import { SystemLogModel, type SystemLogCategory } from "@/lib/db/models/SystemLog";

export interface SystemLogEntry {
  category:    SystemLogCategory;
  action:      string;
  email?:      string;
  actorEmail?: string;
  details?:    Record<string, unknown>;
  ip?:         string;
}

function logLine(entry: SystemLogEntry) {
  console.log(JSON.stringify({ event: "system_log", ...entry }));
}

/** Awaited — use for admin actions and webhook handlers where correctness matters more than latency. */
export async function logSystemEvent(entry: SystemLogEntry): Promise<void> {
  logLine(entry);
  try {
    await connectDB();
    await SystemLogModel.create({ ...entry, createdAt: new Date() });
  } catch {
    // Logging failure must never break the caller's actual operation
  }
}

/** Fire-and-forget — use on hot paths (quota gate, daily-check loop). Never throws, never awaited. */
export function logSystemEventAsync(entry: SystemLogEntry): void {
  logLine(entry);
  void (async () => {
    try {
      await connectDB();
      await SystemLogModel.create({ ...entry, createdAt: new Date() });
    } catch {
      // Logging failure must never affect the caller's hot path
    }
  })();
}
