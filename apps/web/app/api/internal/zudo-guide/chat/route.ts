import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { checkQuota, incrementUsage } from "@/lib/widget/quotaGate";
import { addMessageToSession, getSessionHistory } from "@/lib/memory/memoryService";
import { runWidgetChat } from "@/lib/ai/geminiWidget";

export async function POST(req: NextRequest) {
  try {
    const token = await getServerToken(req);
    if (!token?.sub) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const embedKey = process.env.ZUDO_GUIDE_EMBED_KEY;
    if (!embedKey) {
      console.error("[zudo-guide/chat] ZUDO_GUIDE_EMBED_KEY is not set in environment");
      return NextResponse.json({ ok: false, error: "guide_not_configured" }, { status: 500 });
    }

    let body: { sessionId?: string; message?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

    const { sessionId, message } = body;
    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }
    if (message.length > 800) {
      return NextResponse.json({ ok: false, error: "message_too_long" }, { status: 400 });
    }

    await connectDB();

    const profile = await TenantProfileModel.findOne({ embedKey });
    if (!profile) {
      console.error("[zudo-guide/chat] No TenantProfile found for embedKey:", embedKey.slice(0, 20) + "...");
      return NextResponse.json({ ok: false, error: "guide_not_found" }, { status: 500 });
    }

    const tenantId = profile.tenantId;

    const quota = await checkQuota(tenantId);
    if (!quota.allowed) {
      return NextResponse.json({ ok: true, reply: quota.blockMessage, blocked: true });
    }

    const history = await getSessionHistory(tenantId, sessionId);

    const { reply, error: aiError } = await runWidgetChat(
      profile.botName,
      profile.botTone,
      profile.welcomeMessage,
      history,
      message.trim(),
      undefined,
      profile.botGender,
    );

    if (aiError) {
      console.error("[zudo-guide/chat] Gemini chat degraded:", { tenantId, code: aiError });
    }

    const now           = new Date();
    const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;

    await Promise.all([
      addMessageToSession(tenantId, sessionId, { role: "user",  content: message.trim(), timestamp: now }, retentionDays),
      addMessageToSession(tenantId, sessionId, { role: "model", content: reply,          timestamp: now }, retentionDays),
    ]);

    void incrementUsage(tenantId, profile, quota.limits).catch((e) =>
      console.error("[zudo-guide/chat] incrementUsage failed:", e)
    );

    return NextResponse.json({
      ok: true,
      reply,
      ...(aiError ? { warning: "ai_degraded" } : {}),
    });
  } catch (err) {
    console.error("[zudo-guide/chat] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
