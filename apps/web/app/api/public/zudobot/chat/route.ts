import { NextRequest, NextResponse } from "next/server";
import { runWidgetChat } from "@/lib/ai/geminiWidget";
import { embedText } from "@/lib/ai/geminiEmbed";
import { TenantProfileModel, type ITenantProfile } from "@/lib/db/models/TenantProfile";
import { searchKnowledgeChunks } from "@/lib/knowledge/vectorSearch";
import { addMessageToSession, getSessionHistory } from "@/lib/memory/memoryService";
import { requirePlatformGlobalChatTenantId } from "@/lib/platform/platformGlobalBotEnv";
import { validateGlobalEmbedAccess } from "@/lib/platform/validateGlobalEmbedAccess";
import { unrecord_pii } from "@/lib/security/unrecordPii";
import { checkQuota, incrementUsage } from "@/lib/widget/quotaGate";

export const dynamic = "force-dynamic";

/**
 * Sales/scope directive for the PLATFORM bot only (zudobot.zudogu.com).
 * Passed as runWidgetChat's extraDirective so it never affects customer tenant bots.
 * Reframes the generic "this shop" persona into selling Zudobot itself + a hard CTA.
 */
const ZUDOBOT_SALES_DIRECTIVE = `คุณคือผู้ช่วยขายของ "Zudobot" — แพลตฟอร์ม AI Sales Agent โดยบริษัท Zudogu (ตัวคุณเองคือสินค้า ไม่ใช่ร้านค้าทั่วไป)
- เป้าหมายหลัก: ทำให้ผู้เข้าชมเข้าใจว่า Zudobot ช่วยธุรกิจของเขาได้อย่างไร แล้วชวนให้สมัครทดลองใช้ฟรี
- ตอบเฉพาะเรื่องที่เกี่ยวกับ Zudobot เท่านั้น (ฟีเจอร์ ราคา แพ็กเกจ การติดตั้ง การใช้งาน ความปลอดภัย) ถ้าลูกค้าถามนอกเรื่อง ให้ดึงกลับมาที่ Zudobot อย่างสุภาพ
- ถามกลับเพื่อเข้าใจธุรกิจลูกค้า (ขายอะไร ลูกค้าทักเข้ามาช่องทางไหนมากที่สุด) แล้วแนะนำแพ็กเกจที่เหมาะ
- ใช้ราคา/ฟีเจอร์จากข้อมูลร้านค้า (KB) เท่านั้น ห้ามแต่งเติมหรือเดา
- เมื่อเหมาะสม ให้ปิดท้ายด้วย CTA ชวนทดลองฟรี 14 วัน พร้อมลิงก์ เช่น "เริ่มทดลองฟรี 14 วันได้เลย ไม่ต้องใช้บัตร 👉 https://zudobot.zudogu.com/register" (แปลเป็นภาษาเดียวกับลูกค้าเสมอ)`;

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(data: unknown, status: number, corsOrigin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(corsOrigin) });
}

export async function OPTIONS(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  const embedKey = new URL(req.url).searchParams.get("embedKey");

  const access = await validateGlobalEmbedAccess(embedKey, originHeader, refererHeader);
  if (!access.ok) {
    return new NextResponse(null, { status: access.status });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders(access.corsOrigin) });
}

export async function POST(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  let body: { key?: string; sessionId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }

  const embedKey = body.key?.trim();
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();

  if (!embedKey || !sessionId || !message) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }

  if (message.length > 800) {
    return NextResponse.json(
      { ok: false, error: "message_too_long" },
      { status: 400, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }

  const access = await validateGlobalEmbedAccess(embedKey, originHeader, refererHeader);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }

  const { config, corsOrigin } = access;
  const platformTenantId = requirePlatformGlobalChatTenantId();

  const quota = await checkQuota(platformTenantId);
  if (!quota.allowed) {
    return json({ ok: true, reply: quota.blockMessage, blocked: true }, 200, corsOrigin);
  }

  const profile = await TenantProfileModel.findOne({ tenantId: platformTenantId }).lean();

  const history = await getSessionHistory(platformTenantId, sessionId);

  let knowledgeContext: string | undefined;
  try {
    const queryEmbedding = await embedText(message);
    const chunks = await searchKnowledgeChunks(platformTenantId, queryEmbedding);
    if (chunks.length > 0) {
      knowledgeContext = chunks.join("\n\n---\n\n");
    }
  } catch {
    // non-critical
  }

  const { reply, error: aiError } = await runWidgetChat(
    config.botName,
    profile?.botTone ?? "friendly",
    config.welcomeMessage,
    history,
    message,
    knowledgeContext,
    profile?.botGender ?? "female",
    undefined, // attachments — none on the platform sales widget
    ZUDOBOT_SALES_DIRECTIVE
  );

  const now = new Date();
  const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;
  const storedUserContent = await unrecord_pii(message);

  await Promise.all([
    addMessageToSession(
      platformTenantId,
      sessionId,
      { role: "user", content: storedUserContent, timestamp: now },
      retentionDays
    ),
    addMessageToSession(
      platformTenantId,
      sessionId,
      { role: "model", content: reply, timestamp: now },
      retentionDays
    ),
  ]);

  if (profile) {
    void incrementUsage(platformTenantId, profile as unknown as ITenantProfile, quota.limits).catch(
      () => {}
    );
  }

  return json(
    {
      ok: true,
      reply,
      ...(aiError ? { warning: "ai_degraded" } : {}),
    },
    200,
    corsOrigin
  );
}
