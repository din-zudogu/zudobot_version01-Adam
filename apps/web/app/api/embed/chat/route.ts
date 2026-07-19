import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { checkQuota, incrementUsage } from "@/lib/widget/quotaGate";
import { addMessageToSession, getSessionHistory } from "@/lib/memory/memoryService";
import { runWidgetChat } from "@/lib/ai/geminiWidget";

// ── Layer 3: Upstash Rate Limiter (lazy init) ────────────────────
// Instantiated on first request, not at module load — prevents
// Redis.fromEnv() from running during Next.js "Collecting page data".
let _ratelimit: Ratelimit | null = null;
function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "24 h"),
      prefix:  "zudo:embed:rl",
    });
  }
  return _ratelimit;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function POST(req: NextRequest) {
  let body: { key?: string; sessionId?: string; message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

  const { key: embedKey, sessionId, message } = body;

  if (!embedKey || !sessionId || !message?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (message.length > 800) {
    return NextResponse.json({ ok: false, error: "message_too_long" }, { status: 400 });
  }

  // ── Layer 3: Rate limit check (IP + embedKey) ────────────────────
  const ip         = clientIp(req);
  const rlKey      = `${ip}:${embedKey}`;
  const { success, limit, remaining, reset } = await getRatelimit().limit(rlKey);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After":          String(retryAfter),
          "X-RateLimit-Limit":    String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":    String(reset),
        },
      }
    );
  }

  // ── Business logic ───────────────────────────────────────────────
  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey });

  if (!profile)               return NextResponse.json({ ok: false, error: "invalid_key"     }, { status: 403 });
  if (!profile.widgetEnabled) return NextResponse.json({ ok: false, error: "widget_disabled" }, { status: 403 });

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

  const now           = new Date();
  const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;

  await Promise.all([
    addMessageToSession(tenantId, sessionId, { role: "user",  content: message.trim(), timestamp: now }, retentionDays),
    addMessageToSession(tenantId, sessionId, { role: "model", content: reply,          timestamp: now }, retentionDays),
  ]);

  void incrementUsage(tenantId, profile, quota.limits).catch((e) =>
    console.error("[embed/chat] incrementUsage failed:", e)
  );

  return NextResponse.json(
    { ok: true, reply, ...(aiError ? { warning: "ai_degraded" } : {}) },
    {
      headers: {
        "X-RateLimit-Limit":    String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset":    String(reset),
      },
    }
  );
}
