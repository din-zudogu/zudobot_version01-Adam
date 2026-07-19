/**
 * Auto-extract high-quality few-shot examples from ConversationSession history.
 *
 * Quality criteria for a good example pair:
 *   - User message: 5–80 chars, no detected PII (email/phone)
 *   - Bot response: 20–160 chars, ends on a sentence boundary
 *   - Turn index >= 1 (skip opening exchange, more context needed)
 *   - Engagement: >= 2 more user messages after this pair in the session
 *
 * Runs across ALL tenants. Extracted examples are stored as isGlobal=true
 * so they improve conciseness for every shop, not just the source tenant.
 */
import { connectDB }               from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { FewShotExampleModel }      from "@/lib/db/models/FewShotExample";
import { trimToCompleteSentence }   from "@/lib/ai/textUtils";
import { invalidateFewShotCache }   from "@/lib/ai/fewShotLoader";

// PII guard — skip messages that look like they contain personal info
const PII_RE = /[@@]|(\b\d{9,}\b)|(email|tel|โทร|อีเมล)/i;

const SENTENCE_ENDS = [
  "นะครับ", "นะคะ", "เลยครับ", "เลยคะ",
  "ครับ", "ค่ะ", "คะ", "?", "!", ".", "…",
];

function endsOnSentenceBoundary(text: string): boolean {
  return SENTENCE_ENDS.some((e) => text.trimEnd().endsWith(e));
}

function isGoodUserMsg(msg: string): boolean {
  if (msg.length < 5 || msg.length > 80) return false;
  if (PII_RE.test(msg)) return false;
  return true;
}

function isGoodBotResponse(resp: string): boolean {
  if (resp.length < 20 || resp.length > 160) return false;
  if (!endsOnSentenceBoundary(resp)) return false;
  if (PII_RE.test(resp)) return false;
  return true;
}

export interface ExtractionResult {
  scanned:   number;
  extracted: number;
  skipped:   number;
  duplicate: number;
}

/**
 * Scan recent sessions and extract high-quality examples.
 * @param lookbackDays — how many days back to scan (default 30)
 * @param maxPerRun    — max new examples to insert per run (default 50)
 */
export async function extractFewShotExamples(
  lookbackDays = 30,
  maxPerRun    = 50,
): Promise<ExtractionResult> {
  await connectDB();

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Fetch sessions with at least 6 messages (3 turns minimum)
  const sessions = await ConversationSessionModel
    .find({ createdAt: { $gte: since }, "messages.4": { $exists: true } })
    .select("tenantId messages")
    .lean()
    .limit(500);   // cap to avoid OOM on large deployments

  const result: ExtractionResult = { scanned: sessions.length, extracted: 0, skipped: 0, duplicate: 0 };
  const toInsert: Array<{
    userMessage: string; botResponse: string;
    tenantId: string; engagementScore: number;
  }> = [];

  for (const session of sessions) {
    const msgs = session.messages.filter((m) => m.role === "user" || m.role === "model");

    // Walk consecutive user→model pairs starting at index 2 (skip opening)
    for (let i = 2; i < msgs.length - 1; i++) {
      const userMsg = msgs[i];
      const botMsg  = msgs[i + 1];
      if (!userMsg || !botMsg) continue;
      if (userMsg.role !== "user" || botMsg.role !== "model") continue;

      if (!isGoodUserMsg(userMsg.content))    { result.skipped++; continue; }
      if (!isGoodBotResponse(botMsg.content)) { result.skipped++; continue; }

      // Engagement: count user messages that follow this pair
      const followUpCount = msgs.slice(i + 2).filter((m) => m.role === "user").length;
      if (followUpCount < 2) { result.skipped++; continue; }

      toInsert.push({
        userMessage:     userMsg.content.trim(),
        botResponse:     trimToCompleteSentence(botMsg.content.trim()),
        tenantId:        session.tenantId,
        engagementScore: followUpCount,
      });

      if (toInsert.length >= maxPerRun) break;
    }
    if (toInsert.length >= maxPerRun) break;
  }

  // Deduplicate against existing examples
  for (const item of toInsert) {
    const exists = await FewShotExampleModel.exists({ userMessage: item.userMessage });
    if (exists) { result.duplicate++; continue; }

    await FewShotExampleModel.create({ ...item, isGlobal: true, extractedAt: new Date() });
    result.extracted++;
  }

  if (result.extracted > 0) invalidateFewShotCache();

  return result;
}
