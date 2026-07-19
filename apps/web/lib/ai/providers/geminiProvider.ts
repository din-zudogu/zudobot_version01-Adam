/**
 * Gemini implementation of ChatProvider (Google AI Studio / @google/generative-ai).
 *
 * Owns everything Gemini-specific: SDK calls, the per-request timeout, the
 * retry + model-fallback loop, history sanitisation (Gemini requires strict
 * user/model alternation ending on a model turn), and the optional self-critique
 * pass. Tunable via the same GEMINI_CHAT_* env vars as before.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireGeminiApiKey } from "@/lib/env/amplifyGuardrail";
import { parseGeminiError } from "@/lib/ai/geminiErrors";
import { applySelfCritique } from "@/lib/ai/selfCritique";
import type { ChatGenRequest, ChatGenResult, ChatProvider, ChatTurn } from "./types";

// Tight budget: the whole /api/widget/chat request must finish under the ~30s
// gateway timeout. A 503 "high demand" fails fast (~0.7s), so 2 attempts/model
// stays well clear; only a successful generation (~15s) is slow and returns
// immediately on the first success.
const TIMEOUT_MS   = parseInt(process.env.GEMINI_CHAT_TIMEOUT_MS   ?? "18000", 10);
const MAX_ATTEMPTS = parseInt(process.env.GEMINI_CHAT_MAX_ATTEMPTS ?? "2", 10);
const BACKOFF_MS   = parseInt(process.env.GEMINI_CHAT_BACKOFF_MS   ?? "500", 10);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type GeminiHistory = Array<{ role: string; parts: Array<{ text: string }> }>;

/**
 * Gemini API requires the history to: start with role='user', strictly alternate
 * user → model → user → model, and end with role='model' (the upcoming user
 * message becomes the next turn). On consecutive same-role turns, keep the LAST
 * so the most recent content survives.
 */
function sanitizeHistory(turns: ChatTurn[]): GeminiHistory {
  const msgs: GeminiHistory = turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
  if (msgs.length === 0) return [];

  const firstUser = msgs.findIndex((m) => m.role === "user");
  if (firstUser < 0) return [];
  const trimmed = firstUser > 0 ? msgs.slice(firstUser) : msgs;

  const deduped: GeminiHistory = [];
  for (const msg of trimmed) {
    const last = deduped[deduped.length - 1];
    if (last && last.role === msg.role) deduped[deduped.length - 1] = msg;
    else deduped.push(msg);
  }

  while (deduped.length > 0 && deduped[deduped.length - 1].role === "user") {
    deduped.pop();
  }
  return deduped;
}

export const geminiProvider: ChatProvider = {
  name: "gemini",

  async generateChat(req: ChatGenRequest): Promise<ChatGenResult> {
    const genAI   = new GoogleGenerativeAI(requireGeminiApiKey());
    const history = sanitizeHistory(req.history);
    let lastErr: unknown = null;

    for (const modelId of req.modelCandidates) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const model = genAI.getGenerativeModel(
            {
              model:             modelId,
              systemInstruction: req.systemInstruction,
              generationConfig:  { temperature: req.temperature },
              ...(req.enableSearch ? { tools: [{ googleSearch: {} } as never] } : {}),
            },
            { timeout: req.timeoutMs ?? TIMEOUT_MS },
          );
          const chat     = model.startChat({ history });
          const result   = await chat.sendMessage(req.message as never);
          const rawReply = result.response.text().trim();
          // Self-critique adds a SECOND sequential call (shortens long replies).
          // Opt-in only — it can push long answers past the gateway timeout.
          const reply = process.env.ENABLE_SELF_CRITIQUE === "true"
            ? await applySelfCritique(rawReply, model)
            : rawReply;
          // Observability: which model actually answered (one line per success).
          console.log(`[Gemini Provider] ok model=${modelId}`);
          return { reply, modelUsed: modelId };
        } catch (err: unknown) {
          lastErr = err;
          const parsed = parseGeminiError(err);
          console.error(
            `[Gemini Provider] model=${modelId} attempt=${attempt}/${MAX_ATTEMPTS} code=${parsed.code}: ${parsed.detail}`,
          );

          if (!parsed.isRetryable) {
            // model_not_found → try the next candidate; anything else
            // (auth / precondition / missing key) won't be fixed by retrying.
            if (parsed.kind === "model_not_found") break;
            throw err;
          }
          if (attempt < MAX_ATTEMPTS) {
            await sleep(BACKOFF_MS * 2 ** (attempt - 1));
          }
        }
      }
      // Exhausted this model → fall through to the next candidate.
    }

    console.error("[Gemini Provider] all candidates exhausted");
    throw lastErr ?? new Error("gemini_no_candidates");
  },
};
