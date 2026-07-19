import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { resolveKnowledgeTenantId } from "@/lib/knowledge/resolveKnowledgeTenantId";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { chunkText } from "@/lib/knowledge/scraper";

const MAX_FILE_BYTES  = 4 * 1024 * 1024;
const MAX_TEXT_CHARS  = 150_000;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const name = fileName.toLowerCase();

  if (mimeType === "text/plain" || name.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const data     = await pdfParse(buffer);
    return data.text ?? "";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result  = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  throw new Error("unsupported_type");
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveKnowledgeTenantId(req);
    if ("error" in resolved) {
      const status = resolved.error === "forbidden" ? 403 : resolved.error === "platform_not_configured" ? 503 : 401;
      return json({ ok: false, error: resolved.error }, status);
    }
    const { tenantId } = resolved;

    let formData: FormData;
    try { formData = await req.formData(); }
    catch (err) {
      console.error("[upload] formData parse failed:", err);
      return json({ ok: false, error: "invalid_body" }, 400);
    }

    const file  = formData.get("file")  as File   | null;
    const title = (formData.get("title") as string | null)?.trim().slice(0, 100);

    if (!file)  return json({ ok: false, error: "file_required" },  400);
    if (!title) return json({ ok: false, error: "title_required" }, 400);

    if (file.size > MAX_FILE_BYTES) {
      return json({ ok: false, error: "file_too_large", maxMB: 4 }, 413);
    }

    // Read bytes
    let buffer: Buffer;
    try { buffer = Buffer.from(await file.arrayBuffer()); }
    catch (err) {
      console.error("[upload] arrayBuffer failed:", err);
      return json({ ok: false, error: "read_failed" }, 422);
    }

    // Extract text
    let rawText: string;
    try {
      rawText = (await extractText(buffer, file.type ?? "", file.name)).trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "unsupported_type") return json({ ok: false, error: "unsupported_type" }, 422);
      return json({ ok: false, error: "parse_failed", detail: msg }, 422);
    }

    rawText = rawText.slice(0, MAX_TEXT_CHARS);
    if (rawText.length < 50) return json({ ok: false, error: "content_too_short" }, 422);

    const sourceUrl  = `file::${title}`;
    const totalChunks = chunkText(rawText).length;

    await connectDB();

    // Delete old chunks for this source, then upsert a fresh job
    await KnowledgeChunkModel.deleteMany({ tenantId, sourceUrl });
    await KnowledgeJobModel.findOneAndUpdate(
      { tenantId, sourceUrl },
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

    return json({ ok: true, source: sourceUrl, status: "pending", totalChunks });

  } catch (err) {
    console.error("[knowledge/upload] unhandled error:", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
