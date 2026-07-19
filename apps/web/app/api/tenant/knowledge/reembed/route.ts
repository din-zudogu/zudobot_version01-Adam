/**
 * POST /api/tenant/knowledge/reembed
 *
 * Force re-embed ALL knowledge chunks for this tenant.
 * Useful when embedding model was updated or chunks were corrupted.
 * Re-generates embeddings from existing content — does NOT re-scrape URLs.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/lib/db/connect";
import { resolveKnowledgeTenantId }  from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeChunkModel }       from "@/lib/db/models/KnowledgeChunk";
import { embedText }                 from "@/lib/ai/geminiEmbed";

export const dynamic = "force-dynamic";
const BATCH = 10;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      return json({ ok: false, error: resolved.error }, 401);
    }
    const { tenantId } = resolved;

    // Optional: filter to a specific source URL to avoid Lambda timeout on large KBs
    let body: { sourceUrl?: string; limit?: number; offset?: number } = {};
    try { body = await req.json(); } catch { /* body optional */ }
    const sourceUrl = body.sourceUrl?.trim();
    const limit     = Math.min(200, Math.max(1, body.limit ?? 80));

    await connectDB();

    const offset = Math.max(0, body.offset ?? 0);

    const filter: Record<string, unknown> = { tenantId };
    if (sourceUrl) filter.sourceUrl = sourceUrl;

    const chunks = await KnowledgeChunkModel
      .find(filter)
      .select("_id content")
      .skip(offset)
      .limit(limit)
      .lean();

    if (chunks.length === 0) {
      return json({ ok: true, reembedded: 0, message: "ไม่มี chunk ในระบบ" });
    }

    const total      = await KnowledgeChunkModel.countDocuments(filter);
    let reembedded   = 0;
    let failed       = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      await Promise.all(batch.map(async (chunk) => {
        try {
          const embedding = await embedText(chunk.content);
          if (embedding.length > 0) {
            await KnowledgeChunkModel.updateOne(
              { _id: chunk._id },
              { $set: { embedding } },
            );
            reembedded++;
          }
        } catch {
          failed++;
        }
      }));
    }

    const remaining = total - chunks.length;
    return json({ ok: true, reembedded, failed, processed: chunks.length, total, remaining });
  } catch (err) {
    console.error("[knowledge/reembed]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
