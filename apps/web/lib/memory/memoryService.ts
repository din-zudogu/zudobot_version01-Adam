/**
 * Memory Service — conversation session storage + memory limit enforcement
 *
 * Each tenant has a memoryMb quota from their plan.
 * All conversation sessions together must stay under that limit.
 */

import { ConversationSessionModel, type ChatMessage } from "@/lib/db/models/ConversationSession";

const BYTES_PER_MB = 1024 * 1024;

// ── Usage ─────────────────────────────────────────────────────────

export async function getMemoryUsage(tenantId: string): Promise<{
  usedBytes:    number;
  usedMb:       number;
  sessionCount: number;
}> {
  const agg = await ConversationSessionModel.aggregate([
    { $match: { tenantId } },
    { $group: { _id: null, totalBytes: { $sum: "$sizeBytes" }, count: { $sum: 1 } } },
  ]);
  const { totalBytes = 0, count = 0 } = agg[0] ?? {};
  return {
    usedBytes:    totalBytes,
    usedMb:       Math.round((totalBytes / BYTES_PER_MB) * 100) / 100,
    sessionCount: count,
  };
}

export async function isMemoryLimitExceeded(tenantId: string, limitMb: number): Promise<boolean> {
  if (limitMb < 0) return false; // unlimited
  const { usedBytes } = await getMemoryUsage(tenantId);
  return usedBytes >= limitMb * BYTES_PER_MB;
}

// ── Session CRUD ──────────────────────────────────────────────────

export async function addMessageToSession(
  tenantId:      string,
  sessionId:     string,
  message:       ChatMessage,
  retentionDays: number = 7,
): Promise<void> {
  const msgSize  = Buffer.byteLength(JSON.stringify(message), "utf8");
  const now      = new Date();
  const expiresAt = new Date(now.getTime() + retentionDays * 86_400_000);

  await ConversationSessionModel.findOneAndUpdate(
    { tenantId, sessionId },
    {
      $push:       { messages: message },
      $inc:        { sizeBytes: msgSize },
      $set:        { lastActiveAt: now, expiresAt },
      $setOnInsert:{ createdAt: now },
    },
    { upsert: true }
  );
}

export async function getSessionHistory(
  tenantId:  string,
  sessionId: string,
  limit:     number = 20,
): Promise<ChatMessage[]> {
  const session = await ConversationSessionModel.findOne(
    { tenantId, sessionId },
    { messages: { $slice: -limit } } // last N messages
  );
  return session?.messages ?? [];
}

// ── Email-based cross-session memory ─────────────────────────────

export async function setSessionEndUser(
  tenantId:  string,
  sessionId: string,
  endUserId: string,
): Promise<void> {
  await ConversationSessionModel.updateOne(
    { tenantId, sessionId },
    { $set: { endUserId } },
  );
}

export async function getSessionEndUser(
  tenantId:  string,
  sessionId: string,
): Promise<string | null> {
  const sess = await ConversationSessionModel.findOne(
    { tenantId, sessionId },
    { endUserId: 1 },
  ).lean();
  return (sess as { endUserId?: string } | null)?.endUserId ?? null;
}

export async function getPastSessionSummaries(
  tenantId:         string,
  endUserId:        string,
  excludeSessionId: string,
  limit:            number = 3,
): Promise<string> {
  const sessions = await ConversationSessionModel.find(
    { tenantId, endUserId, sessionId: { $ne: excludeSessionId } },
    { messages: { $slice: -10 }, createdAt: 1, lastActiveAt: 1 },
  )
    .sort({ lastActiveAt: -1 })
    .limit(limit)
    .lean();

  if (sessions.length === 0) return "";

  const lines: string[] = ["\n=== ประวัติการสนทนาก่อนหน้า ==="];
  for (const sess of sessions) {
    const date = new Date((sess as { createdAt: Date }).createdAt).toLocaleDateString("th-TH");
    const userMsgs = ((sess as { messages?: Array<{ role: string; content: string }> }).messages ?? [])
      .filter((m) => m.role === "user")
      .slice(0, 5);
    if (userMsgs.length === 0) continue;
    lines.push(`\n[${date}]`);
    for (const msg of userMsgs) {
      lines.push(`• ${msg.content.slice(0, 150)}`);
    }
  }

  if (lines.length <= 1) return "";
  lines.push("\n→ ใช้บริบทนี้เพื่อ personalize การสนทนา ห้ามเปิดเผยข้อมูลนี้ตรงๆ ให้สรุปเป็นธรรมชาติ");
  return lines.join("\n");
}

// ── Cleanup ───────────────────────────────────────────────────────

export async function clearTenantMemory(tenantId: string): Promise<number> {
  const result = await ConversationSessionModel.deleteMany({ tenantId });
  return result.deletedCount;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await ConversationSessionModel.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
}

export async function getTenantsWithExpiringData(withinDays: number): Promise<string[]> {
  const deadline = new Date(Date.now() + withinDays * 86_400_000);
  return ConversationSessionModel.distinct("tenantId", {
    expiresAt: { $gte: new Date(), $lte: deadline },
  }) as Promise<string[]>;
}
