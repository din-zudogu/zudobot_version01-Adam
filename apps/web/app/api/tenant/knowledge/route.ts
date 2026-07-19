import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }
    const { tenantId } = resolved;

    await connectDB();

    // ── 1. Chunk aggregate → completed sources ────────────────────
    const chunkAgg: { _id: string; chunkCount: number; lastSyncAt: Date }[] =
      await KnowledgeChunkModel.aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$sourceUrl", chunkCount: { $sum: 1 }, lastSyncAt: { $max: "$scrapedAt" } } },
        { $sort: { lastSyncAt: -1 } },
      ]);

    // ── 2. All jobs: active (pending/processing/failed) + recent done ──────
    // "recent done" handles jobs that were marked done by old code (pre-delete-on-complete)
    // rather than being deleted. 24h window keeps the query cheap.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const allJobs = await KnowledgeJobModel.find(
      {
        tenantId,
        $or: [
          { status: { $in: ["pending", "processing", "failed"] } },
          { status: "done", updatedAt: { $gte: oneDayAgo } },
        ],
      },
      { sourceUrl: 1, status: 1, totalChunks: 1, processedChunks: 1, errorMsg: 1, updatedAt: 1 },
    ).lean();

    // ── 3. Merge: chunk aggregate is truth for completed sources ──────────
    const jobMap   = new Map(allJobs.map((j) => [j.sourceUrl, j]));
    const chunkSet = new Set(chunkAgg.map((s) => s._id));

    const sources: {
      url: string; chunkCount: number; lastSyncAt: Date | string;
      status: string; totalChunks?: number; processedChunks?: number; errorMsg?: string;
    }[] = chunkAgg.map((s) => {
      const job = jobMap.get(s._id);
      if (job && job.status !== "done") {
        // Active job overlaps with existing chunks (re-sync in progress)
        return {
          url:             s._id,
          chunkCount:      s.chunkCount,
          lastSyncAt:      s.lastSyncAt,
          status:          job.status,
          totalChunks:     job.totalChunks,
          processedChunks: job.processedChunks,
          errorMsg:        job.errorMsg,
        };
      }
      return { url: s._id, chunkCount: s.chunkCount, lastSyncAt: s.lastSyncAt, status: "done" };
    });

    // ── 4. Jobs with no chunk entry yet ───────────────────────────────────
    for (const job of allJobs) {
      if (chunkSet.has(job.sourceUrl)) continue; // already handled above

      if (job.status === "done") {
        // Orphaned: job was marked done (old code) but zero chunks were saved — show as failed
        sources.unshift({
          url:        job.sourceUrl,
          chunkCount: 0,
          lastSyncAt: job.updatedAt as Date,
          status:     "failed",
          errorMsg:   "ข้อมูลไม่สมบูรณ์ กรุณาลองอัปโหลดใหม่อีกครั้ง",
        });
      } else {
        // New source: pending / processing / failed, no chunks yet
        sources.unshift({
          url:             job.sourceUrl,
          chunkCount:      0,
          lastSyncAt:      job.updatedAt as Date,
          status:          job.status,
          totalChunks:     job.totalChunks,
          processedChunks: job.processedChunks,
          errorMsg:        job.errorMsg,
        });
      }
    }

    return json({ ok: true, sources });

  } catch (err) {
    console.error("[knowledge/GET]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

export async function DELETE(req: NextRequest) {
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

    if (!body.url) return json({ ok: false, error: "url_required" }, 400);

    await connectDB();
    await Promise.all([
      KnowledgeChunkModel.deleteMany({ tenantId, sourceUrl: body.url }),
      KnowledgeJobModel.deleteOne({ tenantId, sourceUrl: body.url }),
    ]);

    return json({ ok: true });

  } catch (err) {
    console.error("[knowledge/DELETE]", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
