/**
 * Non-blocking RAG event logger.
 * Fire-and-forget — never throws, never awaited on the hot path.
 */
import { connectDB }      from "@/lib/db/connect";
import { RagEventLogModel, type RagMethod } from "@/lib/db/models/RagEventLog";
import type { KnowledgeHit } from "@/lib/knowledge/vectorSearch";

export interface RagLogContext {
  tenantId:     string;
  sessionId:    string;
  querySnippet: string;   // caller supplies first 80 chars of raw message
}

export function logRagEvent(
  ctx:        RagLogContext,
  method:     RagMethod,
  hits:       KnowledgeHit[],
  durationMs: number,
): void {
  // Structured CloudWatch log — Level 1 (always emitted, zero cost)
  const topScore = hits[0]?.score ?? 0;
  const avgScore = hits.length
    ? hits.reduce((s, h) => s + h.score, 0) / hits.length
    : 0;

  console.log(
    JSON.stringify({
      event:        "rag_query",
      tenantId:     ctx.tenantId,
      sessionId:    ctx.sessionId,
      method,
      hitsCount:    hits.length,
      topScore:     +topScore.toFixed(3),
      avgScore:     +avgScore.toFixed(3),
      durationMs,
      querySnippet: ctx.querySnippet,
    }),
  );

  // Level 2 — persist to MongoDB (fire-and-forget)
  void (async () => {
    try {
      await connectDB();
      await RagEventLogModel.create({
        tenantId:     ctx.tenantId,
        sessionId:    ctx.sessionId,
        querySnippet: ctx.querySnippet,
        method,
        hitsCount:    hits.length,
        topScore:     +topScore.toFixed(3),
        avgScore:     +avgScore.toFixed(3),
        durationMs,
        createdAt:    new Date(),
      });
    } catch {
      // Logging failure must never affect the chat response
    }
  })();
}
