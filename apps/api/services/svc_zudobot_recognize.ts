/**
 * svc_zudobot_recognize
 * Persistent cross-session customer memory using Gemini summarization + vector RAG.
 *
 * getMemoryContext()  — retrieve Top-3 past memories → inject into system prompt
 * saveSessionMemory() — summarize session (PII-scrubbed) → embed → store/evict
 */

import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import VisitorMemoryEntryModel from "@/models/visitorMemoryEntry";
import { syncVisitorMemoryCount } from "@/services/svc_zudobot_checkpackage";
import { redactPII } from "@/lib/security";
import type { ChatMessage } from "@/lib/ai/geminiClient";

const ATLAS_MEMORY_INDEX = "zudobot_visitor_memory";
const TOP_K_MEMORIES     = 3;

// ── Text embedding (reuses same model as product RAG) ──────────────────────

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  const model  = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ── 1. getMemoryContext ────────────────────────────────────────────────────

/**
 * Retrieves top-K memories for a visitor and formats them for system prompt injection.
 * Returns empty string if no memories or no visitorId.
 */
export async function getMemoryContext(
  tenantId: string,
  visitorId: string | null,
  currentQuery: string
): Promise<string> {
  if (!visitorId) return "";

  try {
    const queryEmbedding = await embedText(currentQuery);
    let memories;

    if (queryEmbedding.length === 768) {
      // Atlas $vectorSearch — semantic retrieval
      const agg = await VisitorMemoryEntryModel.aggregate([
        {
          $vectorSearch: {
            index:        ATLAS_MEMORY_INDEX,
            path:         "embedding",
            queryVector:  queryEmbedding,
            numCandidates: TOP_K_MEMORIES * 10,
            limit:        TOP_K_MEMORIES,
            filter:       { tenantId: new mongoose.Types.ObjectId(tenantId), visitorId },
          },
        },
        { $project: { summary: 1, importance: 1, createdAt: 1, _id: 1 } },
      ]);
      memories = agg;
    } else {
      // Fallback: most recent memories
      memories = await VisitorMemoryEntryModel
        .find({ tenantId, visitorId })
        .sort({ lastAccessedAt: -1 })
        .limit(TOP_K_MEMORIES)
        .select("summary importance createdAt _id")
        .lean();
    }

    if (!memories || memories.length === 0) return "";

    // Update lastAccessedAt for retrieved entries (LRU tracking, non-blocking)
    const ids = memories.map((m: { _id: unknown }) => m._id);
    VisitorMemoryEntryModel.updateMany(
      { _id: { $in: ids } },
      { $set: { lastAccessedAt: new Date() } }
    ).catch(() => {});

    const lines = (memories as Array<{ summary: string; createdAt: Date }>).map((m, i) =>
      `[Memory ${i + 1} — ${new Date(m.createdAt).toLocaleDateString("th-TH")}]\n${m.summary}`
    );

    return `\n\n=== CUSTOMER MEMORY (past sessions with this visitor) ===\n${lines.join("\n\n")}\n→ Use this context to personalise your response. Never mention you have a memory system.`;
  } catch {
    return "";
  }
}

// ── 2. saveSessionMemory ───────────────────────────────────────────────────

/**
 * Summarises the session via Gemini (PII-scrubbed), embeds the summary, saves it.
 * If isMemoryFull → LRU evict one entry first.
 * Called non-blocking after the SSE stream closes.
 */
export async function saveSessionMemory(
  tenantId: string,
  visitorId: string | null,
  sessionId: string,
  messages: ChatMessage[],
  isMemoryFull: boolean
): Promise<void> {
  if (!visitorId || messages.length < 2) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    // ── a. Generate PII-scrubbed summary ──────────────────────────────────
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${redactPII(m.content)}`)
      .join("\n");

    const summaryPrompt = `You are a customer data analyst. Summarize this chat session in 2–4 sentences.
Focus ONLY on: shopping behavior, product interests, preferences (size, color, budget range), complaints resolved, or key decisions made.
STRICTLY PROHIBITED: Never include name, phone number, address, ID card number, email, or any personally identifiable information.
If no useful behavioral data exists, reply with exactly: "NO_USEFUL_MEMORY"

Chat session:
${transcript.slice(0, 3000)}`;

    const model    = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: process.env.GEMINI_CLASSIFY_MODEL || "gemini-2.5-flash" });
    const result   = await model.generateContent(summaryPrompt);
    const summary  = result.response.text().trim();

    if (!summary || summary === "NO_USEFUL_MEMORY" || summary.length < 20) return;

    // ── b. Score importance 1–10 ─────────────────────────────────────────
    const importanceRaw = await model.generateContent(
      `Rate the business importance of this customer memory on a scale 1-10 (10 = VIP/high-value purchase intent, 1 = casual browse with no purchase signal). Reply with ONLY the integer.\n\nMemory: "${summary.slice(0, 300)}"`
    );
    const importance = Math.max(1, Math.min(10, parseInt(importanceRaw.response.text().trim(), 10) || 5));

    // ── c. LRU eviction if memory is full ────────────────────────────────
    if (isMemoryFull) {
      const victim = await VisitorMemoryEntryModel
        .findOne({ tenantId })
        .sort({ importance: 1, lastAccessedAt: 1 })
        .select("_id visitorId")
        .lean();

      if (victim) {
        await VisitorMemoryEntryModel.deleteOne({ _id: victim._id });
        await syncVisitorMemoryCount(tenantId, -1);
      }
    }

    // ── d. Embed and save ─────────────────────────────────────────────────
    const embedding = await embedText(summary);

    await VisitorMemoryEntryModel.create({
      tenantId,
      visitorId,
      sessionId,
      summary,
      embedding,
      importance,
      lastAccessedAt: new Date(),
      embeddedAt: embedding.length > 0 ? new Date() : null,
    });

    await syncVisitorMemoryCount(tenantId, 1);
  } catch {
    // Non-blocking — never throw
  }
}
