/**
 * @file route.ts (Global Chat Backup Cron Endpoint)
 * @description ดึงข้อความแชทรายวันทั้งหมดมาเก็บเข้าคลังใหญ่ ZUDOGU ป้องกันข้อมูลหาย
 * Schedule (vercel.json): 59 16 * * * → ~23:59 Asia/Bangkok
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { ZudobotGlobalBackupModel } from "@/lib/db/models/ZudobotGlobalBackup";
import { getBangkokDayBounds } from "@/lib/cron/bangkokDayBounds";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) return false;

  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true;

  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  return false;
}

async function runGlobalChatBackup() {
  await connectDB();

  const { startOfToday, endOfToday } = getBangkokDayBounds();

  const sessions = await ConversationSessionModel.find({
    "messages.timestamp": { $gte: startOfToday, $lte: endOfToday },
  }).lean();

  let backupCount = 0;

  for (const session of sessions) {
    const sessionDocId = String(session._id);
    const visitorSessionId = session.sessionId;

    for (const msg of session.messages ?? []) {
      const msgTime = new Date(msg.timestamp);
      if (msgTime < startOfToday || msgTime > endOfToday) continue;

      const originalLogId = `${sessionDocId}:${msgTime.getTime()}:${msg.role}`;

      try {
        await ZudobotGlobalBackupModel.create({
          originalLogId,
          tenantId:        session.tenantId,
          sessionId:       visitorSessionId,
          role:            msg.role,
          message:         msg.content,
          tenantCreatedAt: msgTime,
          backedUpAt:      new Date(),
          isProtected:     true,
        });
        backupCount++;
      } catch (dupError: unknown) {
        const code = (dupError as { code?: number })?.code;
        if (code !== 11000) {
          console.error("[Backup Item Error]:", dupError);
        }
      }
    }
  }

  return { backupCount, startOfToday, endOfToday, sessionsScanned: sessions.length };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized Access", { status: 401 });
  }

  try {
    const result = await runGlobalChatBackup();
    return NextResponse.json({
      success:         true,
      recordsBackedUp: result.backupCount,
      sessionsScanned: result.sessionsScanned,
      dayStart:        result.startOfToday.toISOString(),
      dayEnd:          result.endOfToday.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[Global Backup Cron Failure]:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Manual trigger — same auth as delete-tenant cron */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGlobalChatBackup();
    return NextResponse.json({
      success:         true,
      recordsBackedUp: result.backupCount,
      sessionsScanned: result.sessionsScanned,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[Global Backup Cron Failure]:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
