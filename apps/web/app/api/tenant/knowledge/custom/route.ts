import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { chunkText } from "@/lib/knowledge/scraper";

const MAX_CONTENT_CHARS = 150_000;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }
    const { tenantId } = resolved;

    let body: { title?: string; content?: string };
    try { body = await req.json(); }
    catch { return json({ ok: false, error: "invalid_body" }, 400); }

    const title   = body.title?.trim().slice(0, 100);
    const content = body.content?.trim();

    if (!title)   return json({ ok: false, error: "title_required" },   400);
    if (!content) return json({ ok: false, error: "content_required" }, 400);
    if (content.length < 50)              return json({ ok: false, error: "content_too_short" }, 422);
    if (content.length > MAX_CONTENT_CHARS) return json({ ok: false, error: "content_too_long" },  422);

    const sourceUrl   = `custom::${title}`;
    const totalChunks = chunkText(content).length;

    await connectDB();

    await KnowledgeChunkModel.deleteMany({ tenantId, sourceUrl });
    await KnowledgeJobModel.findOneAndUpdate(
      { tenantId, sourceUrl },
      {
        $set: {
          rawText:         content,
          status:          "pending",
          totalChunks,
          processedChunks: 0,
          errorMsg:        undefined,
        },
      },
      { upsert: true, new: true },
    );

    return json({ ok: true, source: sourceUrl, status: "pending", totalChunks });

  } catch (err) {
    console.error("[knowledge/custom]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
