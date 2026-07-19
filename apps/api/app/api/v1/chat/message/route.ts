/**
 * POST /api/v1/chat/message
 * Streams AI response via SSE with full svc_zudobotrules enforcement.
 * Auth: x-api-key (widget) or x-secret-key (server-to-server)
 *
 * Pipeline:
 *   svc_zudobot_checkpackage → svc_zudobotrules → svc_zudobot_recognize (context)
 *   → Gemini SSE → persist + svc_zudobot_recognize (save memory, non-blocking)
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import TenantModel from "@/models/tenant";
import BotConfigModel from "@/models/botConfig";
import ChatSessionModel from "@/models/chatSession";
import KnowledgeBaseModel from "@/models/knowledgeBase";
import RuleViolationModel from "@/models/ruleViolation";
import CustomCommandModel from "@/models/customCommand";
import VisitorProfileModel from "@/models/visitorProfile";
import KnowledgeGapModel from "@/models/knowledgeGap";
import { streamGeminiChat, analyzeSentiment, classifyIntent } from "@/lib/ai/geminiClient";
import { zudobotRules } from "@/services/svc_zudobotrules";
import { sendHandoffAlert } from "@/services/svc_lineNotify";
import { searchProductsByQuery } from "@/services/svc_productEmbedding";
import { checkPackage, incrementMessageCount } from "@/services/svc_zudobot_checkpackage";
import { getConfig, DEFAULT_CONFIGS } from "@/lib/config";
import { logSessionEvent } from "@/lib/audit";
import { redactPII, containsPII } from "@/lib/security";
import { getMemoryContext, saveSessionMemory } from "@/services/svc_zudobot_recognize";
import type { ProductContext, KnowledgeChunk, BotPersona, BotGuardrails, ChatMessage, CustomCommandEntry, ScarcityAlert } from "@/lib/ai/geminiClient";
import type { VisitorTag } from "@/models/visitorProfile";

const HANDOFF_PHRASE        = "ได้แจ้งทีมงานให้ติดต่อกลับ";
const RULES_VIOLATION_TOKEN = "\x00RULES_VIOLATION:";

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, message: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  let body: unknown;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400, cors); }

  const b            = body as Record<string, unknown>;
  const userMessage  = String(b.message || "").trim().slice(0, 4000);
  if (!userMessage)  return err("message is required", 400, cors);

  const sessionId      = typeof b.sessionId === "string" && b.sessionId.trim() ? b.sessionId.trim() : crypto.randomUUID();
  const visitorId      = typeof b.visitorId === "string" ? b.visitorId.trim() : null;
  const clientProducts = Array.isArray(b.products) ? (b.products as ProductContext[]).slice(0, 50) : [];
  const redactedUserMessage = redactPII(userMessage);

  await dbConnect();

  const tenantId = String(auth.tenant._id);

  // ── Tenant active check ──────────────────────────────────────────────────
  const tenant = await TenantModel.findById(tenantId).lean();
  if (!tenant?.isActive) return err("Tenant account inactive", 403, cors);

  // ── Load tenant configs ──────────────────────────────────────────────────
  const maxRecommendations = await getConfig(tenantId, "max_product_recommendations", DEFAULT_CONFIGS.max_product_recommendations);
  const alertCooldownMinutes = await getConfig(tenantId, "alert_cooldown_minutes", DEFAULT_CONFIGS.alert_cooldown_minutes);
  const promptInjectionProtection = await getConfig(tenantId, "prompt_injection_protection", true);
  const piiScrubbingEnabled = await getConfig(tenantId, "pii_scrubbing_enabled", true);

  if (piiScrubbingEnabled && containsPII(userMessage)) {
    const safeMsg = "ขออภัยค่ะ กรุณาอย่าส่งข้อมูลส่วนตัวผ่านแชทนะคะ เช่น รหัสบัตรประชาชน รหัสผ่าน หรือข้อมูลทางการเงิน 🙏";
    await logSessionEvent(sessionId, tenantId, "pii_detected", { redactedMessage: redactedUserMessage }, "system");

    ChatSessionModel.updateOne(
      { sessionId, tenantId },
      {
        $push: { messages: { role: "user", content: redactedUserMessage, timestamp: new Date() } },
        $inc: { messageCount: 1 },
        $set: { lastActiveAt: new Date() },
      }
    ).catch(() => {});

    const encoder = new TextEncoder();
    const blocked = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: safeMsg })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, piiBlocked: true })}\n\n`));
        controller.close();
      },
    });
    return new Response(blocked, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors } });
  }

  // ── svc_zudobot_checkpackage — Gatekeeper ────────────────────────────────
  const pkgCheck = await checkPackage(tenantId);
  if (!pkgCheck.canChat) {
    const upgradeMsg = "ขออภัยค่ะ โควต้าข้อความของร้านหมดแล้ว กรุณาอัปเกรดแพ็กเกจเพื่อใช้งานต่อค่ะ 🙏";
    const encoder    = new TextEncoder();
    const blocked    = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: upgradeMsg })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, blockedByPackage: true, reason: pkgCheck.blockedReason })}\n\n`));
        controller.close();
      },
    });
    return new Response(blocked, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors } });
  }

  const config = await BotConfigModel.findOne({ tenantId }).lean();

  // ── Session restore / create ─────────────────────────────────────────────
  let session = await ChatSessionModel.findOne({ sessionId, tenantId });
  if (!session) {
    session = await ChatSessionModel.create({ tenantId, sessionId, visitorId, messages: [] });
  }

  // ── Human handoff active or bot paused — skip AI entirely ───────────────────────────────
  if (session.botStatus === "handoff_active" || session.botStatus === "paused") {
    const now = new Date();
    const statusMsg = session.botStatus === "paused" ? "⏸️ บอทถูกหยุดชั่วคราวโดยเจ้าหน้าที่" : "⏳ เจ้าหน้าที่กำลังดูแลอยู่ กรุณารอสักครู่นะคะ";
    ChatSessionModel.updateOne(
      { sessionId, tenantId },
      {
        $push: { messages: { role: "user", content: redactedUserMessage, timestamp: now } },
        $inc: { messageCount: 1 },
        $set: { lastActiveAt: now },
      }
    ).catch(() => {});

    const encoder = new TextEncoder();
    const skipStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: statusMsg })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, pausedMode: session.botStatus === "paused", handoffMode: session.botStatus === "handoff_active" })}\n\n`));
        controller.close();
      },
    });
    return new Response(skipStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors },
    });
  }

  // Session-level rate limiting
  const maxPerSession = config?.maxMessagesPerSession ?? 20;
  if ((session.messageCount ?? 0) >= maxPerSession) {
    return err(`Session limit of ${maxPerSession} messages reached.`, 429, cors);
  }

  const history: ChatMessage[] = session.messages.slice(-12).map((m) => ({
    role: m.role as "user" | "model",
    content: m.content,
  }));

  // ── svc_zudobotrules — Layer 2 Pre-check ─────────────────────────────────
  const preCheck = promptInjectionProtection
    ? zudobotRules.checkInput({
        role: "user",
        text: userMessage,
        sessionContext: { tenantId, conversationHistory: history, messageCount: session.messageCount ?? 0 },
      })
    : { pass: true, violatedRules: [], action: "allow" as const };


  if (!preCheck.pass) {
    const log = zudobotRules.buildViolationLog(preCheck, userMessage, sessionId, tenantId);
    RuleViolationModel.create({ ...log, layer: "pre", tenantId, sessionId }).catch(() => {});

    const safeMsg = preCheck.safeResponse ?? "ขออภัยค่ะ ไม่สามารถประมวลผลคำขอนั้นได้ค่ะ 🙏";
    const encoder = new TextEncoder();
    const blocked = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: safeMsg })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, blockedByRules: true, violatedRules: preCheck.violatedRules })}\n\n`));
        controller.close();
      },
    });
    return new Response(blocked, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors } });
  }

  // ── RAG + Knowledge + Signals ─────────────────────────────────────────────
  const ragProducts = await searchProductsByQuery(tenantId, userMessage, 5).catch(() => [] as ProductContext[]);
  const products: ProductContext[] = ragProducts.length > 0 ? ragProducts : clientProducts;

  const scarcityAlerts: ScarcityAlert[] = products
    .filter((p) => p.stock !== undefined && p.stock > 0 && p.stock <= 5)
    .map((p) => ({ name: p.name, stock: p.stock as number }));

  const userSignals: string[] = preCheck.detectedSignals ?? [];

  const knowledgeDocs = await KnowledgeBaseModel.find({ tenantId, isActive: true }).select("title content").limit(5).lean();
  const knowledge: KnowledgeChunk[] = knowledgeDocs.map((k) => ({ title: String(k.title || ""), content: String(k.content || "") }));

  // ── svc_zudobot_recognize — retrieve customer memory context ─────────────
  const memoryContext = await getMemoryContext(tenantId, visitorId, userMessage);

  // ── Custom Commands (Layer 3) ─────────────────────────────────────────────
  const botName = config?.botName || "Zudobot";
  const cmdDocs = await CustomCommandModel
    .find({ tenantId, isActive: true })
    .sort({ priority: -1 })
    .limit(20)
    .lean();
  const customCommands: CustomCommandEntry[] = cmdDocs.map((c) => ({
    commandType: c.commandType,
    priority:    c.priority,
    commandContent: c.commandContent
      .replace(/\{\{bot_name\}\}/gi,  botName)
      .replace(/\{\{shop_name\}\}/gi, config?.botName || botName),
  }));

  let storeBaseUrl = "";
  try {
    const originRaw = req.headers.get("origin") || req.headers.get("referer") || "";
    if (originRaw && originRaw !== "null") storeBaseUrl = new URL(originRaw).origin;
  } catch { /* ignore */ }

  const persona: BotPersona = {
    botName:         config?.botName || "Zudobot",
    backstory:       config?.backstory || "",
    toneOfVoice:     (config?.toneOfVoice as BotPersona["toneOfVoice"]) || "FRIENDLY",
    primaryLanguage: (config?.primaryLanguage as BotPersona["primaryLanguage"]) || "th",
    customKnowledge: (config?.customKnowledge || "") + memoryContext,
    shippingPolicy:  config?.shippingPolicy || "",
    returnPolicy:    config?.returnPolicy || "",
    storeBaseUrl,
  };

  const guardrails: BotGuardrails = {
    maxDiscountPercent: config?.maxDiscountPercent ?? 10,
    forbiddenTopics:    config?.forbiddenTopics ?? [],
  };

  const { stream, injectionDetected, blockedByRules, ruleViolations } = await streamGeminiChat({
    userMessage, products, knowledge, persona, guardrails, history,
    customCommands, userSignals, scarcityAlerts,
    maxRecommendations,
  });

  const encoder      = new TextEncoder();
  let fullResponse   = "";
  let postViolations: string[] = [...ruleViolations];

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.startsWith(RULES_VIOLATION_TOKEN)) {
            const codes = chunk.slice(RULES_VIOLATION_TOKEN.length).split(",");
            postViolations = [...postViolations, ...codes];
            fullResponse   = "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองถามใหม่อีกครั้งนะคะ 🙏";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, injectionDetected, blockedByRules: true, violatedRules: postViolations })}\n\n`));
            return;
          }
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, injectionDetected, blockedByRules })}\n\n`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();

        const now        = new Date();
        const isHandoff  = fullResponse.includes(HANDOFF_PHRASE);
        const sentimentP = analyzeSentiment(userMessage);
        const intentP    = classifyIntent(userMessage);
        const redactedResponse = redactPII(fullResponse);

        // Build full message list for memory summary (user turn + bot response)
        const sessionMessagesForMemory: ChatMessage[] = [
          ...history,
          { role: "user",  content: redactedUserMessage },
          { role: "model", content: redactedResponse },
        ];

        Promise.all([
          // Persist session messages
          ChatSessionModel.updateOne(
            { sessionId, tenantId },
            {
              $push: { messages: { $each: [
                { role: "user",  content: redactedUserMessage,  timestamp: now },
                { role: "model", content: redactedResponse, timestamp: now },
              ]}},
              $inc: { messageCount: 1 },
              $set: {
                lastActiveAt: now,
                handoffRequested: isHandoff,
                ...(isHandoff ? { botStatus: "handoff_pending", handoffAt: now } : {}),
              },
            }
          ),
          // Increment usage counter (replaces old messageBalance -1)
          incrementMessageCount(tenantId),
          // Sentiment & Intent analysis
          Promise.all([sentimentP, intentP]).then(([sentiment, intent]) =>
            ChatSessionModel.updateOne(
              { sessionId, tenantId },
              {
                $set: { sentiment, intent },
                $push: { intentLogs: { intent, confidence: 0.8, timestamp: now } }, // Simplified confidence
              }
            )
          ),
          // LINE Messaging API push on handoff with cooldown and deep link token
          isHandoff
            ? ChatSessionModel.findOne({ sessionId, tenantId }).lean().then((sess) => {
                if (sess && (!sess.alertCooldownUntil || new Date() > sess.alertCooldownUntil)) {
                  const deepLinkToken = crypto.randomUUID();
                  return TenantModel.findById(tenantId).lean().then((t) => {
                    if (t?.lineEnabled && t?.lineChannelToken && t?.lineUserId) {
                      return sendHandoffAlert(t.lineChannelToken, t.lineUserId, {
                        shopName: config?.botName || t.name || "Zudobot Shop",
                        sessionId, visitorId, lastMessage: redactedUserMessage,
                      }, deepLinkToken).then(async () => {
                        const cooldownUntil = new Date(now.getTime() + alertCooldownMinutes * 60 * 1000);
                        await ChatSessionModel.updateOne(
                          { sessionId, tenantId },
                          { $set: { alertCooldownUntil: cooldownUntil } }
                        );
                        await logSessionEvent(sessionId, tenantId, "handoff", { deepLinkToken, cooldownMinutes: alertCooldownMinutes }, "system");
                        await logSessionEvent(sessionId, tenantId, "alert_sent", { type: "line_messaging_api", cooldownMinutes: alertCooldownMinutes }, "system");
                      });
                    }
                  });
                }
              }).catch(() => {})
            : Promise.resolve(),
          // Post-check rule violations
          postViolations.length > 0
            ? RuleViolationModel.create({
                ruleIds: postViolations, category: "Post-check",
                triggerText: fullResponse.slice(0, 200), action: "block",
                layer: "post", tenantId, sessionId, timestamp: now,
              })
            : Promise.resolve(),
          // CRM: upsert visitor profile
          visitorId
            ? sentimentP.then((score) => {
                const autoTags: VisitorTag[] = [];
                if (userSignals.includes("buying_intent"))       autoTags.push("prospect");
                if (userSignals.includes("checkout_ready"))      autoTags.push("hot_lead");
                if (userSignals.includes("price_inquiry"))       autoTags.push("price_shopper");
                if (userSignals.includes("comparison_shopping")) autoTags.push("comparison");
                if (userSignals.includes("low_budget_mentioned"))autoTags.push("budget_sensitive");
                if (isHandoff)                                   autoTags.push("handoff_requested");

                return VisitorProfileModel.findOneAndUpdate(
                  { tenantId, visitorId },
                  {
                    $inc: { totalMessages: 1 },
                    $set: { lastSeenAt: now, lastSentiment: score, lastMessage: redactedUserMessage.slice(0, 200) },
                    $setOnInsert: { firstSeenAt: now, sessionCount: 1 },
                    ...(autoTags.length > 0 ? { $addToSet: { tags: { $each: autoTags } } } : {}),
                  },
                  { upsert: true, new: false }
                ).then((existing) => {
                  if (!existing) return;
                  const isNewSession = !session.messages || session.messages.length <= 2;
                  if (isNewSession) {
                    return VisitorProfileModel.updateOne(
                      { tenantId, visitorId },
                      { $inc: { sessionCount: 1 } }
                    ).then((r) => {
                      if (r.modifiedCount > 0) {
                        return VisitorProfileModel.updateOne(
                          { tenantId, visitorId, sessionCount: { $gte: 3 } },
                          { $addToSet: { tags: "repeat_visitor" } }
                        );
                      }
                    });
                  }
                });
              })
            : Promise.resolve(),
          // Knowledge Gap logging
          ragProducts.length === 0 && knowledge.length === 0
            ? KnowledgeGapModel.findOneAndUpdate(
                { tenantId, query: redactedUserMessage.slice(0, 300) },
                { $inc: { frequency: 1 }, $setOnInsert: { sessionId } },
                { upsert: true, new: false }
              ).catch(() => {})
            : Promise.resolve(),
          // svc_zudobot_recognize — save session memory (non-blocking)
          saveSessionMemory(tenantId, visitorId, sessionId, sessionMessagesForMemory, pkgCheck.isMemoryFull)
            .catch(() => {}),
        ]).catch(() => {});
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...cors },
  });
}
