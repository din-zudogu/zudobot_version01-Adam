import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { scrapeUrl, chunkText, checkLoginRequired, type ScrapeBlockedError } from "@/lib/knowledge/scraper";

const RATE_LIMIT_MS = 5 * 60 * 1_000; // 5 min per URL

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

    let body: { url?: string };
    try { body = await req.json(); }
    catch { return json({ ok: false, error: "invalid_body" }, 400); }

    const { url } = body;
    if (!url) return json({ ok: false, error: "url_required" }, 400);

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); }
    catch { return json({ ok: false, error: "invalid_url" }, 400); }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return json({ ok: false, error: "invalid_url" }, 400);
    }

    // Block login-required platforms before attempting any scrape
    try { checkLoginRequired(url); }
    catch (e) {
      const blocked = e as ScrapeBlockedError;
      if (blocked.reason === "login_required") {
        return json({ ok: false, error: "login_required", hostname: blocked.hostname }, 422);
      }
    }

    await connectDB();

    // Rate limit: check last scrapedAt on existing chunks OR an active job
    const recentChunk = await KnowledgeChunkModel
      .findOne({ tenantId, sourceUrl: url })
      .sort({ scrapedAt: -1 })
      .select("scrapedAt")
      .lean();
    if (recentChunk && Date.now() - new Date(recentChunk.scrapedAt).getTime() < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - new Date(recentChunk.scrapedAt).getTime())) / 1_000);
      return json({ ok: false, error: "rate_limited", retryAfterSeconds: wait }, 429);
    }

    // Scrape — this is fast enough to be synchronous (~2-5s)
    let rawText: string;
    try { rawText = await scrapeUrl(url); }
    catch (err) {
      return json({
        ok:     false,
        error:  "scrape_failed",
        detail: err instanceof Error ? err.message : "unknown",
      }, 422);
    }

    if (rawText.length < 100) return json({ ok: false, error: "content_too_short" }, 422);

    const totalChunks = chunkText(rawText).length;

    // Delete old chunks, upsert job
    await KnowledgeChunkModel.deleteMany({ tenantId, sourceUrl: url });
    await KnowledgeJobModel.findOneAndUpdate(
      { tenantId, sourceUrl: url },
      {
        $set: {
          rawText,
          status:          "pending",
          totalChunks,
          processedChunks: 0,
          errorMsg:        undefined,
        },
      },
      { upsert: true, new: true },
    );

    return json({ ok: true, url, status: "pending", totalChunks });

  } catch (err) {
    console.error("[knowledge/sync]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
