import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { chunkText } from "@/lib/knowledge/scraper";
import { embedText, resolveEmbedModelName } from "@/lib/ai/geminiEmbed";
import { formatGeminiErrorDetail, parseGeminiError } from "@/lib/ai/geminiErrors";

const BATCH_SIZE = 20;

type ChunkDoc = {
  tenantId:   string;
  sourceUrl:  string;
  content:    string;
  embedding:  number[];
  chunkIndex: number;
  scrapedAt:  Date;
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

function isGeminiApiKeyConfigured(): boolean {
  return !!(
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY_LIVE?.trim()
  );
}

/** Server-side only — never include in client JSON. */
function logGeminiErrorForCloudWatch(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[GEMINI_CRITICAL_FAIL] ${label}:`, message);

  const fields: Record<string, unknown> = {};
  if (err instanceof Error) {
    fields.message = err.message;
    fields.name = err.name;
    const extra = err as Error & {
      status?: number | string;
      statusText?: string;
      code?: string | number;
      response?: { data?: unknown; status?: number };
      errorDetails?: unknown;
    };
    if (extra.status != null) fields.status = extra.status;
    if (extra.statusText) fields.statusText = extra.statusText;
    if (extra.code != null) fields.code = extra.code;
    if (extra.errorDetails != null) fields.errorDetails = extra.errorDetails;
    if (extra.response != null) {
      if (extra.response.status != null) fields.responseStatus = extra.response.status;
      if (extra.response.data != null) fields.responseData = extra.response.data;
    }
  } else if (typeof err === "object" && err !== null) {
    fields.serialized = err;
  } else {
    fields.serialized = err;
  }

  try {
    console.error(`[GEMINI_CRITICAL_FAIL] ${label} structure:`, JSON.stringify(fields));
  } catch {
    console.error(`[GEMINI_CRITICAL_FAIL] ${label} structure:`, formatGeminiErrorDetail(err));
  }
}

async function markJobFailed(jobId: unknown, parsed: ReturnType<typeof parseGeminiError>) {
  try {
    await KnowledgeJobModel.updateOne(
      { _id: jobId },
      {
        $set: {
          status:   "failed",
          errorMsg: parsed.userMessageTh,
        },
      },
    );
  } catch { /* ignore secondary error */ }
}

/** Isolated embed — one chunk failure must not abort siblings. */
async function embedSingleChunk(
  text:       string,
  tenantId:   string,
  sourceUrl:  string,
  chunkIndex: number,
  scrapedAt:  Date,
  modelName:  string,
): Promise<{ ok: true; doc: ChunkDoc } | { ok: false; error: unknown }> {
  try {
    const embedding = await embedText(text, modelName);
    if (!embedding.length) {
      return { ok: false, error: new Error("empty_embedding") };
    }
    return {
      ok:  true,
      doc: { tenantId, sourceUrl, content: text, embedding, chunkIndex, scrapedAt },
    };
  } catch (error: unknown) {
    const errString = error instanceof Error ? error.message : String(error);
    console.error(
      `[GEMINI_EMBED_DIAGNOSTIC] Chunk Index ${chunkIndex} failed: ${errString}`,
    );
    logGeminiErrorForCloudWatch(`chunk_${chunkIndex}`, error);
    return { ok: false, error };
  }
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  let tenantId:  string | undefined;
  let sourceUrl: string | undefined;

  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }
    tenantId = resolved.tenantId;

    let body: { sourceUrl?: string };
    try { body = await req.json(); }
    catch { return json({ ok: false, error: "invalid_body" }, 400); }

    sourceUrl = body.sourceUrl;
    if (!sourceUrl) return json({ ok: false, error: "sourceUrl_required" }, 400);

    await connectDB();

    const job = await KnowledgeJobModel.findOneAndUpdate(
      { tenantId, sourceUrl, status: { $in: ["pending", "processing"] } },
      { $set: { status: "processing" } },
      { new: true },
    );

    if (!job) return json({ ok: true, status: "done", done: true });

    const offset    = job.processedChunks;
    const allChunks = chunkText(job.rawText);
    const batch     = allChunks.slice(offset, offset + BATCH_SIZE);

    if (batch.length === 0) {
      await KnowledgeJobModel.deleteOne({ _id: job._id });
      return json({ ok: true, status: "done", done: true, processedChunks: offset, totalChunks: allChunks.length });
    }

    const embedded: ChunkDoc[] = [];
    const now          = new Date();
    const modelInUse   = resolveEmbedModelName();
    let firstEmbedError: unknown;
    let failedInBatch = 0;

    console.info(
      `[KNOWLEDGE_PROCESS_ENTRY] [${timestamp}] Tenant: ${tenantId} | Found Chunks: ${batch.length} | Targeted Model: ${modelInUse}`,
    );
    console.info("[DIAGNOSTIC] GEMINI_API_KEY Configured:", isGeminiApiKeyConfigured());

    const results = await Promise.all(
      batch.map((text, index) =>
        embedSingleChunk(
          text,
          tenantId!,
          job.sourceUrl,
          offset + index,
          now,
          modelInUse,
        ),
      ),
    );
    for (const r of results) {
      if (r.ok) {
        embedded.push(r.doc);
      } else {
        failedInBatch++;
        if (firstEmbedError === undefined) firstEmbedError = r.error;
      }
    }

    console.info(
      `[KNOWLEDGE_PROCESS_END] Processed successfully: ${embedded.length}/${batch.length}`,
    );

    if (embedded.length === 0) {
      const parsed = parseGeminiError(firstEmbedError ?? "unknown");
      console.error("[GEMINI_CRITICAL_FAIL_BATCH] Diagnostic Trace:", firstEmbedError);
      logGeminiErrorForCloudWatch("batch_zero_embeddings", firstEmbedError ?? "unknown");
      console.error("[knowledge/process] batch produced zero embeddings:", {
        code: parsed.code,
        kind: parsed.kind,
        detail: formatGeminiErrorDetail(firstEmbedError),
        failedInBatch,
        model: modelInUse,
        apiKeyConfigured: isGeminiApiKeyConfigured(),
      });
      await markJobFailed(job._id, parsed);
      return json(
        {
          ok:          false,
          error:       parsed.code,
          status:      "failed",
          userMessage: parsed.userMessageTh,
          isRetryable: parsed.isRetryable,
          ...(process.env.NODE_ENV === "development" ? { detail: parsed.detail } : {}),
        },
        parsed.httpStatus,
      );
    }

    await KnowledgeChunkModel.insertMany(embedded);

    const newProcessed = offset + batch.length;
    const isDone       = newProcessed >= allChunks.length;

    if (isDone) {
      const savedCount = await KnowledgeChunkModel.countDocuments({
        tenantId,
        sourceUrl: job.sourceUrl,
      });
      if (savedCount === 0) {
        const parsed = parseGeminiError(firstEmbedError ?? "no_chunks_saved");
        await markJobFailed(job._id, parsed);
        return json(
          {
            ok:          false,
            error:       parsed.code,
            status:      "failed",
            userMessage: parsed.userMessageTh,
            isRetryable: parsed.isRetryable,
          },
          parsed.httpStatus,
        );
      }
      await KnowledgeJobModel.deleteOne({ _id: job._id });
    } else {
      await KnowledgeJobModel.updateOne(
        { _id: job._id },
        { $set: { processedChunks: newProcessed, totalChunks: allChunks.length, status: "processing" } },
      );
    }

    return json({
      ok:              true,
      status:          isDone ? "done" : "processing",
      done:            isDone,
      processedChunks: newProcessed,
      totalChunks:     allChunks.length,
      embeddedCount:   embedded.length,
      failedInBatch,
    });

  } catch (err: unknown) {
    const parsed = parseGeminiError(err);
    logGeminiErrorForCloudWatch(`route_exception_${timestamp}`, err);
    const criticalMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[CRITICAL_KNOWLEDGE_ROUTE_EXCEPTION] [${timestamp}]:`,
      criticalMsg || parsed.detail,
    );
    console.error("[knowledge/process] critical error:", parsed.detail);
    if (tenantId && sourceUrl) {
      try {
        await connectDB();
        await KnowledgeJobModel.updateOne(
          { tenantId, sourceUrl },
          {
            $set: {
              status:   "failed",
              errorMsg: parsed.userMessageTh,
            },
          },
        );
      } catch { /* ignore secondary error */ }
    }
    return json(
      {
        ok:          false,
        error:       parsed.code,
        status:      "failed",
        userMessage: parsed.userMessageTh,
        isRetryable: parsed.isRetryable,
        ...(process.env.NODE_ENV === "development" ? { detail: parsed.detail } : {}),
      },
      parsed.httpStatus,
    );
  }
}
