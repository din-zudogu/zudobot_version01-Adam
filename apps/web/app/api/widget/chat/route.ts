import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { ProductModel } from "@/lib/db/models/Product";
import { checkQuota, incrementUsage, type QuotaCheckResult } from "@/lib/widget/quotaGate";
import { addMessageToSession, getSessionHistory } from "@/lib/memory/memoryService";
import { runWidgetChat, type GeminiFileAttachment } from "@/lib/ai/geminiWidget";
import { parseGeminiError }          from "@/lib/ai/geminiErrors";
import { trimToCompleteSentence }    from "@/lib/ai/textUtils";
import { maybeRunSelfLearning }      from "@/lib/ai/selfLearningScheduler";
import { embedText } from "@/lib/ai/geminiEmbed";
import { searchKnowledgeChunksWithScores } from "@/lib/knowledge/vectorSearch";
import { KnowledgeChunkModel }             from "@/lib/db/models/KnowledgeChunk";
import { logRagEvent } from "@/lib/knowledge/ragEventLogger";
import { sendHandoffAlert } from "@/lib/services/lineNotify";
import { detectHandoffIntent } from "@/lib/handoff/handoffDetector";
import { unrecord_pii } from "@/lib/security/unrecordPii";
import { enforceRateLimit, clientIp } from "@/lib/security/rateLimit";
import {
  collectEffectiveAllowedDomains,
  isHostnameAllowedForProfile,
  isPlatformSiteWidgetAccess,
} from "@/lib/widget/platformSiteWidgetAccess";
import {
  setSessionEndUser,
  getSessionEndUser,
  getPastSessionSummaries,
} from "@/lib/memory/memoryService";

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

// Line ID detection — customers share either an @-handle ("@myshop") or an id
// after a "line"/"ไลน์" keyword ("line id: shop123", "ไลน์ shop123"). Stored as
// the endUserId identity key, namespaced with a "line:" prefix so it can never
// collide with an email address used by another visitor.
const LINE_HANDLE_REGEX  = /(?:^|\s)@([a-z0-9._-]{2,30})\b/i;
const LINE_KEYWORD_REGEX = /(?:line\s*id|ไลน์(?:\s*ไอดี)?|ไอดี\s*ไลน์)\s*[:：=]?\s*@?([a-z0-9._-]{3,30})/i;

function extractLineId(message: string): string | null {
  const kw = LINE_KEYWORD_REGEX.exec(message);
  if (kw?.[1]) return `line:${kw[1].toLowerCase()}`;
  const handle = LINE_HANDLE_REGEX.exec(message);
  if (handle?.[1]) return `line:${handle[1].toLowerCase()}`;
  return null;
}

export const dynamic = "force-dynamic";

// Buying intent keywords (Thai + English)
const BUYING_SIGNALS = [
  "ราคา","price","ซื้อ","buy","สั่ง","order","อยากได้","want","ต้องการ","need",
  "มีขาย","in stock","สินค้า","product","แนะนำ","recommend","ดีไหม","good",
  "เปรียบเทียบ","compare","ใช้อะไร","which one","ตัวไหน","what","ยี่ห้อ","brand",
];

function hasBuyingIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return BUYING_SIGNALS.some((kw) => lower.includes(kw));
}

export interface RecommendedProduct {
  _id?:               string;
  name:               string;
  price:              number;
  priceSuffix:        string;
  description:        string;
  slug:               string;
  imageUrl?:          string;
  productUrl?:        string;
  stripePaymentLink?: string;
  stock?:             number | null;
}

// ── CORS ──────────────────────────────────────────────────────────

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function json(data: unknown, status: number, origin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Helpers ───────────────────────────────────────────────────────

function normalizeHostname(raw: string): string | null {
  try {
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    const { hostname } = new URL(url);
    if (!hostname) return null;
    return hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawOrigin = req.headers.get("origin") || req.headers.get("referer") || "";

  let body: {
    key?:          string;
    sessionId?:    string;
    message?:      string;
    consentGiven?: boolean;
    attachments?:  GeminiFileAttachment[];
    visitorId?:    string;
  };
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "invalid_body" }, 400, rawOrigin); }

  const { key: embedKey, sessionId, message, attachments, visitorId: _visitorId } = body;
  void _visitorId; // reserved for future persistent tracking

  // Security: validate attachments array (max 3, no unknown keys)
  const safeAttachments: GeminiFileAttachment[] = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments.slice(0, 3)) {
      if (typeof att?.mimeType === "string") {
        safeAttachments.push({
          base64:    typeof att.base64   === "string" ? att.base64   : undefined,
          fileUri:   typeof att.fileUri  === "string" ? att.fileUri  : undefined,
          mimeType:  att.mimeType,
          fileName:  typeof att.fileName === "string" ? att.fileName : "file",
          sizeBytes: typeof att.sizeBytes === "number" ? att.sizeBytes : 0,
        });
      }
    }
  }

  // Allow message to be empty only if there are attachments
  if (!embedKey || !sessionId || (!message?.trim() && safeAttachments.length === 0)) {
    return json({ ok: false, error: "missing_fields" }, 400, rawOrigin);
  }

  if ((message ?? "").length > 800) {
    return json({ ok: false, error: "message_too_long" }, 400, rawOrigin);
  }

  // ── Rate limit (anti-abuse / cost-drain) — per IP + embedKey ──────
  // Caps automated hammering of this public AI endpoint (each call hits Gemini =
  // cost). 60 msg/min per IP+tenant is far above any human conversation but stops
  // bots; the per-tenant quota gate handles cost. Fail-open if Redis is down.
  const rl = await enforceRateLimit(`${clientIp(req)}:${embedKey}`, {
    prefix: "zudo:widget:rl",
    max:    60,
    window: "60 s",
  });
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return json({ ok: false, error: "rate_limited", retryAfter }, 429, rawOrigin);
  }

  // ── 1. Domain whitelist ──────────────────────────────────────────
  const requestHostname = normalizeHostname(rawOrigin);
  if (!requestHostname) {
    return json({ ok: false, error: "missing_origin" }, 403, rawOrigin);
  }

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey });

  if (!profile) {
    return json({ ok: false, error: "invalid_key" }, 403, rawOrigin);
  }

  const platformSiteAccess = await isPlatformSiteWidgetAccess(embedKey, requestHostname);

  if (!profile.widgetEnabled && !platformSiteAccess) {
    return json({ ok: false, error: "widget_disabled" }, 403, rawOrigin);
  }

  const effectiveDomains = collectEffectiveAllowedDomains(profile);

  const isAllowed =
    isHostnameAllowedForProfile(requestHostname, effectiveDomains) ||
    platformSiteAccess;

  if (!isAllowed) {
    return json({ ok: false, error: "domain_not_allowed" }, 403, rawOrigin);
  }

  const tenantId = profile.tenantId;

  // ── 2. Quota gate ────────────────────────────────────────────────
  // The platform's own site tenant isn't a real signed-up User/plan (checkQuota
  // does UserModel.findOne({ _id: tenantId }), which would throw a CastError for
  // its synthetic tenantId) — treat it as unlimited, same bypass spirit as the
  // widgetEnabled/domain checks above.
  const quota: QuotaCheckResult = platformSiteAccess
    ? { allowed: true, blockMessage: "", limits: { retentionDays: -1, isTrial: false, isMonthly: false }, currentUsage: 0 }
    : await checkQuota(tenantId);
  if (!quota.allowed) {
    return json({ ok: true, reply: quota.blockMessage, blocked: true }, 200, rawOrigin);
  }

  // ── 2b. Check session state + detect handoff intent from INPUT ───
  const activeSession    = await ConversationSessionModel.findOne({ tenantId, sessionId }).lean();
  const currentBotStatus = activeSession?.botStatus ?? "bot";

  const rawMessage = (message ?? "").trim();

  // Already in handoff_active — skip AI, save message, return waiting msg
  if (currentBotStatus === "handoff_active") {
    const now           = new Date();
    const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;
    const storedUserContent = await unrecord_pii(rawMessage);
    await addMessageToSession(
      tenantId, sessionId,
      { role: "user", content: storedUserContent, timestamp: now },
      retentionDays,
    );
    return json(
      { ok: true, reply: "⏳ เจ้าหน้าที่กำลังดูแลอยู่ กรุณารอสักครู่นะคะ", handoffMode: true },
      200,
      rawOrigin,
    );
  }

  // Input-based handoff detection — fire BEFORE calling Gemini
  const { isHandoff, matchedKeyword } = detectHandoffIntent(rawMessage);

  if (isHandoff && currentBotStatus !== "handoff_pending") {
    const now           = new Date();
    const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;
    const confirmReply  = "ได้เลยค่ะ กำลังแจ้งทีมงานให้ทราบแล้ว เจ้าหน้าที่จะมาดูแลคุณเร็วๆ นี้นะคะ 😊 กรุณารอสักครู่นะคะ";
    const storedUserContent = await unrecord_pii(rawMessage);

    // Persist customer message + confirmation reply
    await Promise.all([
      addMessageToSession(tenantId, sessionId, { role: "user",  content: storedUserContent, timestamp: now }, retentionDays),
      addMessageToSession(tenantId, sessionId, { role: "model", content: confirmReply,      timestamp: now }, retentionDays),
    ]);

    // Update session status
    ConversationSessionModel.updateOne(
      { tenantId, sessionId },
      { $set: { botStatus: "handoff_pending", handoffRequested: true, handoffAt: now } },
    ).catch(() => {});

    // Generate short-lived deep link token (10 min)
    const deepLinkToken = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    ConversationSessionModel.updateOne(
      { tenantId, sessionId },
      { $push: { deepLinkTokens: { token: deepLinkToken, expiresAt: tokenExpiresAt } } }
    ).catch(() => {});

    // Fire LINE Messaging API push with deep link token
    if (profile.lineEnabled && profile.lineChannelToken && profile.lineUserId) {
      sendHandoffAlert(profile.lineChannelToken, profile.lineUserId, {
        shopName:    profile.botName || "Zudobot Shop",
        sessionId,
        visitorId:   null,
        lastMessage: rawMessage,
        deepLinkToken,
      });
    }

    // Non-blocking accounting
    void incrementUsage(tenantId, profile, quota.limits).catch(() => {});

    return json(
      { ok: true, reply: confirmReply, handoffMode: true, matchedKeyword: matchedKeyword?.keyword },
      200,
      rawOrigin,
    );
  }

  // ── 3. Fetch session history ─────────────────────────────────────
  const history = await getSessionHistory(tenantId, sessionId);

  // ── 4. RAG: Knowledge Base lookup ────────────────────────────────
  // Strategy:
  //   A. URL-sourced chunks (websites): always force-loaded in full —
  //      they're typically small (10-30 chunks) and directly relevant
  //      to customer questions. Never let semantic search miss them.
  //   B. File-sourced chunks: hybrid semantic+keyword search for relevant
  //      sections (can be hundreds of chunks).
  //   Merge A+B and deduplicate.
  let knowledgeContext: string | undefined;
  try {
    const ragStart = Date.now();

    // A. Load ALL URL-sourced chunks (sourceUrl starts with http)
    const urlChunks = await KnowledgeChunkModel
      .find({ tenantId, sourceUrl: /^https?:\/\//i })
      .select("content")
      .lean();
    const urlContents = urlChunks.map(c => c.content);

    // B. Hybrid semantic+keyword search over ALL chunks (includes files)
    let fileContents: string[] = [];
    let method: import("@/lib/knowledge/vectorSearch").SearchMethod = "miss";
    const fileChunkCount = await KnowledgeChunkModel.countDocuments({
      tenantId,
      sourceUrl: { $not: /^https?:\/\//i },
    });
    if (fileChunkCount > 0) {
      const queryEmbedding = await embedText(rawMessage);
      const result = await searchKnowledgeChunksWithScores(tenantId, queryEmbedding, 6, 0.2, rawMessage);
      fileContents = result.hits.map(h => h.content);
      method       = result.method;
    } else if (urlContents.length > 0) {
      method = "js_fallback";
    }

    // Merge: URL chunks first (always fresh), then file search results
    const seen      = new Set<string>();
    const hitContents: string[] = [];
    for (const c of [...urlContents, ...fileContents]) {
      if (!seen.has(c)) { seen.add(c); hitContents.push(c); }
    }

    const ragDurationMs = Date.now() - ragStart;
    const hits = hitContents.map(c => ({ content: c, score: 1 }));
    logRagEvent(
      { tenantId, sessionId: sessionId!, querySnippet: rawMessage.slice(0, 80) },
      method,
      hits,
      ragDurationMs,
    );

    if (hitContents.length > 0) {
      knowledgeContext = hitContents.join("\n\n---\n\n");
    }
  } catch (ragError) {
    console.error("[widget/chat] RAG lookup warning (non-critical):", ragError);
  }

  // ── 4b. Product search for buying intent ─────────────────────────
  let recommendedProducts: RecommendedProduct[] = [];
  if (hasBuyingIntent(rawMessage)) {
    try {
      const products = await ProductModel.find({
        tenantId,
        isActive: true,
        $text: { $search: rawMessage },
      })
        .select("name price priceSuffix shortDescription slug imageUrl productUrl stripePaymentLink stock")
        .limit(3)
        .lean();

      const mapProduct = (p: typeof products[number]) => ({
        _id:               (p as { _id: { toString(): string } })._id.toString(),
        name:              p.name,
        price:             p.price,
        priceSuffix:       p.priceSuffix || "",
        description:       p.shortDescription || "",
        slug:              p.slug || "",
        imageUrl:          p.imageUrl,
        productUrl:        p.productUrl,
        stripePaymentLink: p.stripePaymentLink,
        stock:             p.stock,
      });

      if (products.length === 0) {
        // Fallback: return latest 3 active products
        const fallback = await ProductModel.find({ tenantId, isActive: true })
          .select("name price priceSuffix shortDescription slug imageUrl productUrl stripePaymentLink stock")
          .sort({ updatedAt: -1 })
          .limit(3)
          .lean();
        recommendedProducts = fallback.map(mapProduct);
      } else {
        recommendedProducts = products.map(mapProduct);
      }
    } catch {
      // product search is non-critical
    }
  }

  // Inject product context into knowledge for Gemini
  if (recommendedProducts.length > 0 && !knowledgeContext) {
    knowledgeContext = "## สินค้าแนะนำที่เกี่ยวข้อง\n" +
      recommendedProducts.map((p) =>
        `- ${p.name}: ${p.price === -1 ? "ติดต่อสอบถาม" : `฿${p.price.toLocaleString()}${p.priceSuffix}`}` +
        (p.description ? ` — ${p.description}` : "") +
        (p.stock !== null && p.stock !== undefined && p.stock <= 5 ? ` (เหลือ ${p.stock} ชิ้น!)` : "")
      ).join("\n");
  }

  // ── 4c. Email / Line ID extraction → cross-session memory lookup ──
  // If the message contains an email OR a Line ID, store it as the identity and
  // load past sessions. Also reuse a known endUserId from a prior turn.
  let pastMemoryContext = "";
  try {
    const extractedId =
      EMAIL_REGEX.exec(rawMessage)?.[0]?.toLowerCase() ??
      extractLineId(rawMessage);
    const existingEndUser = await getSessionEndUser(tenantId, sessionId!);
    const resolvedId = extractedId ?? existingEndUser;

    if (resolvedId) {
      if (extractedId && extractedId !== existingEndUser) {
        void setSessionEndUser(tenantId, sessionId!, resolvedId).catch(() => {});
      }
      pastMemoryContext = await getPastSessionSummaries(tenantId, resolvedId, sessionId!);
    }
  } catch {
    // non-critical — never block the chat
  }

  if (pastMemoryContext) {
    knowledgeContext = knowledgeContext
      ? `${knowledgeContext}\n\n${pastMemoryContext}`
      : pastMemoryContext;
  }

  // ── 5. Call Gemini ────────────────────────────────────────────────
  let reply: string;
  let aiError: string | undefined;

  try {
    const result = await runWidgetChat(
      profile.botName,
      profile.botTone,
      profile.welcomeMessage,
      history,
      rawMessage,
      knowledgeContext,
      profile.botGender,
      safeAttachments.length > 0 ? safeAttachments : undefined,
    );
    // Option C safety net: ensure reply ends on a complete sentence
    reply   = trimToCompleteSentence(result.reply);
    aiError = result.error;
  } catch (err: unknown) {
    const parsed = parseGeminiError(err);
    console.error("[widget/chat] Gemini runtime error:", parsed.detail);
    reply = `ขออภัย ${parsed.userMessageTh}`;
    aiError = parsed.code;
  }

  const now           = new Date();
  const retentionDays = quota.limits.retentionDays < 0 ? 36500 : quota.limits.retentionDays;

  // Build user message content for history storage.
  // Attachments are COMPRESSED for storage: store description only (no binary data).
  let storedUserContent = await unrecord_pii(rawMessage);
  if (safeAttachments.length > 0) {
    const attDesc = safeAttachments.map(a => {
      const typeLabel = a.mimeType.startsWith("image/")       ? "🖼️ รูปภาพ"
                      : a.mimeType.startsWith("audio/")       ? "🎵 ไฟล์เสียง"
                      : a.mimeType.startsWith("video/")       ? "🎬 วิดีโอ"
                      : a.mimeType === "application/pdf"       ? "📄 PDF"
                      : "📎 ไฟล์";
      const kb = Math.round(a.sizeBytes / 1024);
      return `[${typeLabel}: ${a.fileName} (${kb} KB)]`;
    }).join(" ");
    storedUserContent = storedUserContent
      ? `${storedUserContent} ${attDesc}`
      : attDesc;
    // NOTE: base64/fileUri are intentionally NOT stored in history to save space.
    // The AI's reply (which describes the file content) is stored instead.
  }

  // ── 6. Persist messages to session ───────────────────────────────
  await Promise.all([
    addMessageToSession(tenantId, sessionId, { role: "user",  content: storedUserContent, timestamp: now }, retentionDays),
    addMessageToSession(tenantId, sessionId, { role: "model", content: reply,             timestamp: now }, retentionDays),
  ]);

  // ── 7. Accounting (non-blocking) ─────────────────────────────────
  void incrementUsage(tenantId, profile, quota.limits).catch((e) =>
    console.error("[widget/chat] incrementUsage failed:", e)
  );

  // ── 8. Self-learning piggyback (fire-and-forget, never blocks) ───
  maybeRunSelfLearning();

  return json(
    {
      ok: true,
      reply,
      ...(aiError ? { warning: "ai_degraded" } : {}),
      ...(recommendedProducts.length > 0 ? { products: recommendedProducts } : {}),
    },
    200,
    rawOrigin,
  );
}

