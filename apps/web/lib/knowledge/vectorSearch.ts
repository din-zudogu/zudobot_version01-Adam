import { connectDB } from "@/lib/db/connect";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface KnowledgeHit {
  content: string;
  score:   number; // 0.0–1.0 cosine similarity
}

/** Which search path was actually used — returned alongside hits for logging. */
export type SearchMethod = "atlas" | "js_fallback" | "miss";

export interface SearchResult {
  hits:   KnowledgeHit[];
  method: SearchMethod;
}

/**
 * Extract candidate keywords from user message for hybrid search.
 * Picks tokens that look like product/entity names:
 *   - All-caps words (ZUDOBUZZ, ZUDOMAR)
 *   - CamelCase or Title-case words longer than 3 chars
 *   - Quoted strings
 */
export function extractKeywords(query: string): string[] {
  const tokens = new Set<string>();

  // All-caps acronym-style words e.g. ZUDOBUZZ
  const capsRe = /\b[A-Z][A-Z0-9]{2,}\b/g;
  let m: RegExpExecArray | null;
  while ((m = capsRe.exec(query)) !== null) tokens.add(m[0]);

  // CamelCase / Title case words e.g. Zudobuzz, ZudoBuzz
  const camelRe = /\b[A-Z][a-z]{2,}(?:[A-Z][a-z]*)*/g;
  while ((m = camelRe.exec(query)) !== null) tokens.add(m[0]);

  // Thai words that appear in quotes
  const quoteRe = /['"]([^'"]{2,30})['"]/g;
  while ((m = quoteRe.exec(query)) !== null) tokens.add(m[1]);

  // Any word longer than 4 chars
  query.split(/\s+/).filter(w => w.length > 4).forEach(w => tokens.add(w.toLowerCase()));

  return Array.from(tokens).filter(Boolean);
}

/** Returns hits WITH similarity scores AND the search method used. */
export async function searchKnowledgeChunksWithScores(
  tenantId:       string,
  queryEmbedding: number[],
  limit    = 5,
  minScore = 0.3,
  queryText = "",   // optional raw query for keyword boost
): Promise<SearchResult> {
  await connectDB();

  // Primary: Atlas Vector Search
  try {
    const results = await KnowledgeChunkModel.aggregate([
      {
        $vectorSearch: {
          index:         "ZUDOBOT_MEMORY",
          path:          "embedding",
          queryVector:   queryEmbedding,
          numCandidates: limit * 20,
          limit,
          filter:        { tenantId },
        },
      },
      { $project: { content: 1, score: { $meta: "vectorSearchScore" }, _id: 0 } },
    ]);
    const hits = results.filter((r: { score: number }) => r.score >= minScore) as KnowledgeHit[];
    if (hits.length > 0) return { hits, method: "atlas" };
    // Atlas returned candidates but all below threshold → fall through to JS
  } catch {
    // Atlas not configured → fall through to JS fallback
  }

  // Fallback: JavaScript cosine similarity
  const chunks = await KnowledgeChunkModel
    .find({ tenantId })
    .select("content embedding")
    .limit(400)
    .lean();

  const semanticHits = chunks
    .map(c => ({ content: c.content, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Keyword boost: find chunks that contain entity names from the query
  // (handles cases where semantic similarity is low for specific product names)
  const keywords = queryText ? extractKeywords(queryText) : [];
  let keywordHits: KnowledgeHit[] = [];
  if (keywords.length > 0) {
    const pattern = new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
    keywordHits = chunks
      .filter(c => pattern.test(c.content))
      .map(c => ({ content: c.content, score: Math.max(minScore, cosineSimilarity(queryEmbedding, c.embedding)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // Merge: keyword hits first (guaranteed relevant), then semantic, deduplicate
  const seen = new Set<string>();
  const hits: KnowledgeHit[] = [];
  for (const h of [...keywordHits, ...semanticHits]) {
    if (!seen.has(h.content)) { seen.add(h.content); hits.push(h); }
    if (hits.length >= limit) break;
  }

  return { hits, method: hits.length > 0 ? "js_fallback" : "miss" };
}

/** Backward-compatible wrapper returning only content strings. */
export async function searchKnowledgeChunks(
  tenantId:       string,
  queryEmbedding: number[],
  limit    = 4,
  minScore = 0.3,
): Promise<string[]> {
  const { hits } = await searchKnowledgeChunksWithScores(tenantId, queryEmbedding, limit, minScore);
  return hits.map(h => h.content);
}
