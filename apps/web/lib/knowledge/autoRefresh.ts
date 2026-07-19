/**
 * Knowledge Base auto-refresh engine (server-side, used by the cron route).
 *
 * One "tick" does as much work as fits in a wall-clock budget, then returns —
 * the next cron tick resumes exactly where it left off (state in the schedule
 * doc's `cycle`). This keeps every HTTP call well under the Lambda/gateway
 * timeout while still walking the WHOLE knowledge base "ทีละตัวจนครบ".
 *
 * Per source:
 *   - URL source   → re-scrape the page, replace its chunks, re-embed (refetch → drain)
 *   - file/custom  → re-embed existing chunks in place (content can't change)
 *
 * Also drives continuous self-learning: each tick runs the existing few-shot
 * extractor when its own interval is due, so every tenant's bot keeps learning.
 */
import { connectDB } from "@/lib/db/connect";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import {
  KnowledgeRefreshScheduleModel,
  type IKnowledgeRefreshSchedule,
} from "@/lib/db/models/KnowledgeRefreshSchedule";
import { scrapeUrl, chunkText } from "@/lib/knowledge/scraper";
import { embedText, resolveEmbedModelName } from "@/lib/ai/geminiEmbed";
import { getSelfLearningConfig, SelfLearningConfigModel } from "@/lib/db/models/SelfLearningConfig";
import { extractFewShotExamples } from "@/lib/ai/fewShotExtractor";

const DEFAULT_MAX_RUN_MS  = 22_000; // keep the HTTP response under the ~30s gateway timeout
const MAX_TENANTS_PER_RUN = 5;      // catch up across ticks; avoids one slow tenant starving others
const EMBED_BATCH         = 10;     // chunks embedded between deadline checks / state saves
const MIN_SCRAPE_LEN      = 100;    // mirror /sync: ignore near-empty scrapes

type SourceType = "url" | "file" | "custom";
function sourceType(sourceUrl: string): SourceType {
  if (sourceUrl.startsWith("file::"))   return "file";
  if (sourceUrl.startsWith("custom::")) return "custom";
  return "url";
}

export interface RefreshCronSummary {
  tenantsProcessed: number;
  urlsRefetched:    number;
  chunksReembedded: number;
  sourcesCompleted: number;
  failed:           number;
  selfLearning:     unknown;
}

/** Distinct knowledge sources for a tenant (URL + file:: + custom::). */
async function listSources(tenantId: string): Promise<string[]> {
  const urls = await KnowledgeChunkModel.distinct("sourceUrl", { tenantId });
  return (urls as string[]).filter(Boolean);
}

/** Embed + insert the next batch of a pending KnowledgeJob. Returns true when the job is fully drained. */
async function drainJobBatch(
  tenantId: string,
  sourceUrl: string,
  deadline: number,
  sched: IKnowledgeRefreshSchedule,
  summary: RefreshCronSummary,
): Promise<boolean> {
  const modelName = resolveEmbedModelName();

  while (Date.now() < deadline) {
    const job = await KnowledgeJobModel.findOne({
      tenantId,
      sourceUrl,
      status: { $in: ["pending", "processing"] },
    });
    if (!job) return true; // nothing to drain

    const allChunks = chunkText(job.rawText);
    const offset    = job.processedChunks;
    const batch     = allChunks.slice(offset, offset + EMBED_BATCH);

    if (batch.length === 0) {
      await KnowledgeJobModel.deleteOne({ _id: job._id });
      return true;
    }

    const now  = new Date();
    const docs: Array<{
      tenantId: string; sourceUrl: string; content: string;
      embedding: number[]; chunkIndex: number; scrapedAt: Date;
    }> = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const embedding = await embedText(batch[i], modelName);
        if (embedding.length > 0) {
          docs.push({ tenantId, sourceUrl, content: batch[i], embedding, chunkIndex: offset + i, scrapedAt: now });
        }
      } catch { /* one chunk failure must not abort the batch */ }
    }

    if (docs.length > 0) {
      await KnowledgeChunkModel.insertMany(docs);
      summary.chunksReembedded         += docs.length;
      sched.lastResult!.chunksReembedded += docs.length;
    }

    const newProcessed = offset + batch.length;
    if (newProcessed >= allChunks.length) {
      await KnowledgeJobModel.deleteOne({ _id: job._id });
      return true;
    }
    await KnowledgeJobModel.updateOne(
      { _id: job._id },
      { $set: { processedChunks: newProcessed, totalChunks: allChunks.length, status: "processing" } },
    );
  }
  return false; // deadline reached — job persists, resume next tick
}

/** Re-embed existing chunks of a file/custom source in place, from the cycle cursor. Returns true when done. */
async function reembedSourceBatch(
  tenantId: string,
  sourceUrl: string,
  sched: IKnowledgeRefreshSchedule,
  deadline: number,
  summary: RefreshCronSummary,
): Promise<boolean> {
  const modelName = resolveEmbedModelName();
  const total = await KnowledgeChunkModel.countDocuments({ tenantId, sourceUrl });

  while (Date.now() < deadline) {
    const cursor = sched.cycle!.cursor;
    if (cursor >= total) return true;

    const chunks = await KnowledgeChunkModel
      .find({ tenantId, sourceUrl })
      .select("_id content")
      .sort({ chunkIndex: 1 })
      .skip(cursor)
      .limit(EMBED_BATCH)
      .lean();

    if (chunks.length === 0) return true;

    for (const c of chunks) {
      try {
        const embedding = await embedText(c.content, modelName);
        if (embedding.length > 0) {
          await KnowledgeChunkModel.updateOne({ _id: c._id }, { $set: { embedding } });
          summary.chunksReembedded         += 1;
          sched.lastResult!.chunksReembedded += 1;
        }
      } catch { /* keep old embedding on failure — still valid */ }
    }

    sched.cycle!.cursor += chunks.length;
    sched.markModified("cycle");
    await sched.save();
  }
  return false; // deadline — resume from cursor next tick
}

/** Advance one tenant's refresh cycle within the shared deadline. */
async function refreshTenantTick(
  sched: IKnowledgeRefreshSchedule,
  deadline: number,
  summary: RefreshCronSummary,
): Promise<void> {
  const tenantId = sched.tenantId;

  // Start a new cycle if idle and due.
  if (!sched.cycle) {
    const sources = await listSources(tenantId);
    const startedAt = new Date();
    sched.cycle = { startedAt, queue: sources, current: null, phase: "refetch", cursor: 0 };
    sched.status = "running";
    sched.lastRunAt = startedAt;
    // Tentatively schedule the next cycle from this start; the current cycle may
    // span several ticks but `cycle != null` keeps it draining regardless.
    sched.nextRunAt = new Date(Date.now() + sched.intervalHours * 3_600_000);
    sched.lastResult = {
      startedAt, urlsRefetched: 0, chunksReembedded: 0, sourcesCompleted: 0, failed: 0, errors: [],
    };
    sched.markModified("cycle");
    await sched.save();
  }

  while (Date.now() < deadline) {
    const cyc = sched.cycle!;

    // Pick the next source if none in progress.
    if (!cyc.current) {
      const next = cyc.queue.shift();
      if (!next) {
        // Cycle complete.
        sched.lastResult!.finishedAt = new Date();
        sched.cycle = null;
        sched.status = "idle";
        await sched.save();
        return;
      }
      cyc.current = next;
      cyc.phase   = sourceType(next) === "url" ? "refetch" : "reembed";
      cyc.cursor  = 0;
      sched.markModified("cycle");
      await sched.save();
    }

    const src   = cyc.current!;
    const stype = sourceType(src);
    let sourceDone = false;

    try {
      if (stype === "url" && cyc.phase === "refetch") {
        // Re-scrape FIRST; only replace chunks once we have fresh content
        // (a failed scrape must not wipe the existing knowledge).
        const text = await scrapeUrl(src);
        if (text.length >= MIN_SCRAPE_LEN) {
          await KnowledgeChunkModel.deleteMany({ tenantId, sourceUrl: src });
          await KnowledgeJobModel.findOneAndUpdate(
            { tenantId, sourceUrl: src },
            {
              $set: {
                rawText:         text,
                status:          "pending",
                totalChunks:     chunkText(text).length,
                processedChunks: 0,
                errorMsg:        undefined,
              },
            },
            { upsert: true },
          );
          sched.lastResult!.urlsRefetched += 1;
          summary.urlsRefetched           += 1;
          cyc.phase = "drain";
          sched.markModified("cycle");
          await sched.save();
        } else {
          sched.lastResult!.errors.push(`${src}: content_too_short`);
          sourceDone = true;
        }
      } else if (stype === "url" /* cyc.phase === "drain" */) {
        sourceDone = await drainJobBatch(tenantId, src, deadline, sched, summary);
      } else {
        sourceDone = await reembedSourceBatch(tenantId, src, sched, deadline, summary);
      }
    } catch (err) {
      // Hard failure on this source (e.g. scrape blocked / network) — skip it,
      // keep its existing chunks, and move on.
      sched.lastResult!.failed += 1;
      sched.lastResult!.errors.push(`${src}: ${err instanceof Error ? err.message : "error"}`);
      summary.failed           += 1;
      sourceDone = true;
    }

    if (sourceDone) {
      sched.lastResult!.sourcesCompleted += 1;
      summary.sourcesCompleted           += 1;
      cyc.current = null;
      cyc.phase   = "refetch";
      cyc.cursor  = 0;
      sched.markModified("cycle");
      await sched.save();
    }
  }

  // Deadline hit mid-cycle — persist and resume next tick.
  sched.markModified("cycle");
  await sched.save();
}

/** Run global self-learning (few-shot extraction) when its interval is due. */
async function maybeRunSelfLearning(): Promise<unknown> {
  const cfg = await getSelfLearningConfig();
  if (!cfg.enabled) return { skipped: "disabled" };
  if (cfg.nextRunAt && cfg.nextRunAt > new Date()) return { skipped: "not_due" };

  const result = await extractFewShotExamples(cfg.lookbackDays, cfg.maxPerRun);
  const intervalMs = cfg.intervalHours * 3_600_000;
  await SelfLearningConfigModel.updateOne(
    { key: "global" },
    { $set: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + intervalMs), lastResult: result } },
  );
  return result;
}

/**
 * One cron tick: advance self-learning + the due tenants' refresh cycles,
 * all within a shared wall-clock budget.
 */
export async function runRefreshCron(opts: { maxRunMs?: number } = {}): Promise<RefreshCronSummary> {
  const deadline = Date.now() + (opts.maxRunMs ?? DEFAULT_MAX_RUN_MS);
  await connectDB();

  const summary: RefreshCronSummary = {
    tenantsProcessed: 0, urlsRefetched: 0, chunksReembedded: 0,
    sourcesCompleted: 0, failed: 0, selfLearning: null,
  };

  // 1) Continuous self-learning (global, all tenants).
  try {
    summary.selfLearning = await maybeRunSelfLearning();
  } catch (err) {
    console.error("[kb-auto-refresh] self-learning failed:", err instanceof Error ? err.message : err);
    summary.selfLearning = { error: true };
  }

  // 2) Tenant KB refresh — in-progress cycles first, then newly-due ones.
  const now = new Date();
  const due = await KnowledgeRefreshScheduleModel
    .find({
      enabled: true,
      $or: [
        { cycle: { $ne: null } },
        { nextRunAt: null },
        { nextRunAt: { $lte: now } },
      ],
    })
    .limit(MAX_TENANTS_PER_RUN);

  for (const sched of due) {
    if (Date.now() >= deadline) break;
    summary.tenantsProcessed += 1;
    try {
      await refreshTenantTick(sched, deadline, summary);
    } catch (err) {
      console.error(`[kb-auto-refresh] tenant ${sched.tenantId} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return summary;
}
