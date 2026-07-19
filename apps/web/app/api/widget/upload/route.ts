/**
 * POST /api/widget/upload
 *
 * Validates and processes file attachments from the chat widget.
 * Security: MIME magic-bytes validation, size limit, rate limiting, origin check.
 *
 * Hybrid A+B strategy:
 *   ≤ 5 MB  → inline base64 (Option A, sent directly to Gemini)
 *   5–10 MB → Google Files API upload → fileUri reference (Option B)
 *             Falls back to inline if Files API unavailable.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import {
  collectEffectiveAllowedDomains,
  isHostnameAllowedForProfile,
  isPlatformSiteWidgetAccess,
} from "@/lib/widget/platformSiteWidgetAccess";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES      = 10 * 1024 * 1024; // 10 MB
const INLINE_THRESHOLD    = 5  * 1024 * 1024; // 5 MB — use inline below this
const MAX_FILES_PER_MIN   = 10;               // per session rate limit (tracked in-memory)
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg","image/png","image/gif","image/webp","image/bmp",
  "application/pdf",
  "audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm",
  "video/mp4","video/webm","video/quicktime",
]);

// ── Magic-bytes signatures (first bytes of file) ──────────────────────
interface MagicSig { bytes: number[]; mime: string; offset?: number; }
const MAGIC_SIGNATURES: MagicSig[] = [
  { bytes: [0xFF,0xD8,0xFF],             mime: "image/jpeg" },
  { bytes: [0x89,0x50,0x4E,0x47],        mime: "image/png"  },
  { bytes: [0x47,0x49,0x46],             mime: "image/gif"  },
  { bytes: [0x52,0x49,0x46,0x46],        mime: "image/webm" }, // RIFF (WAV/WebP)
  { bytes: [0x25,0x50,0x44,0x46],        mime: "application/pdf" },
  { bytes: [0x49,0x44,0x33],             mime: "audio/mpeg" }, // ID3 MP3
  { bytes: [0xFF,0xFB],                  mime: "audio/mpeg" }, // MP3 sync
  { bytes: [0x66,0x74,0x79,0x70],        mime: "video/mp4", offset: 4 }, // ftyp box
  { bytes: [0x1A,0x45,0xDF,0xA3],        mime: "video/webm"  },
  { bytes: [0x4F,0x67,0x67,0x53],        mime: "audio/ogg"  }, // OggS
];

function detectMimeFromBytes(buffer: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (match) return sig.mime;
  }
  return null;
}

// ── Simple in-memory rate limiter (per session, resets every minute) ──
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(sessionKey: string): boolean {
  const now    = Date.now();
  const entry  = rateMap.get(sessionKey);
  if (!entry || entry.resetAt < now) {
    rateMap.set(sessionKey, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= MAX_FILES_PER_MIN) return false;
  entry.count++;
  return true;
}

// ── CORS ──────────────────────────────────────────────────────────────
function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status: number, origin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Upload handler to Google Files API (Option B) ─────────────────────
async function uploadToGoogleFilesApi(
  data:     Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_LIVE;
  if (!apiKey) return null;
  try {
    // Step 1: Initiate resumable upload
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command":  "start",
          "X-Goog-Upload-Header-Content-Length": String(data.byteLength),
          "X-Goog-Upload-Header-Content-Type":   mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { displayName: fileName } }),
      }
    );
    const uploadUrl = initRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) return null;

    // Step 2: Upload bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(data.byteLength),
        "X-Goog-Upload-Offset":  "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: Buffer.from(data),
    });
    if (!uploadRes.ok) return null;
    const result = await uploadRes.json() as { file?: { uri?: string } };
    return result?.file?.uri ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawOrigin = req.headers.get("origin") || req.headers.get("referer") || "";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ ok: false, error: "invalid_form" }, 400, rawOrigin);
  }

  const embedKey = formData.get("key") as string | null;
  const file     = formData.get("file") as File | null;

  if (!embedKey || !file) {
    return json({ ok: false, error: "missing_fields" }, 400, rawOrigin);
  }

  // ── Domain whitelist ────────────────────────────────────────────────
  let requestHostname: string | null = null;
  try {
    const url = rawOrigin.startsWith("http") ? rawOrigin : `https://${rawOrigin}`;
    requestHostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch { /* ignore */ }

  if (!requestHostname) {
    return json({ ok: false, error: "missing_origin" }, 403, rawOrigin);
  }

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey }).lean();
  if (!profile) return json({ ok: false, error: "invalid_key" }, 403, rawOrigin);

  const platformAccess = await isPlatformSiteWidgetAccess(embedKey, requestHostname);
  const effectiveDomains = collectEffectiveAllowedDomains(profile);
  const isAllowed =
    isHostnameAllowedForProfile(requestHostname, effectiveDomains) || platformAccess;
  if (!isAllowed) return json({ ok: false, error: "domain_not_allowed" }, 403, rawOrigin);

  // ── Rate limit (per tenant+session) ────────────────────────────────
  const sessionKey = `${profile.tenantId}:${rawOrigin}`;
  if (!checkRateLimit(sessionKey)) {
    return json({ ok: false, error: "rate_limit_exceeded" }, 429, rawOrigin);
  }

  // ── File size validation ────────────────────────────────────────────
  if (file.size > MAX_FILE_BYTES) {
    return json({ ok: false, error: "file_too_large", maxMb: 10 }, 400, rawOrigin);
  }
  if (file.size === 0) {
    return json({ ok: false, error: "empty_file" }, 400, rawOrigin);
  }

  // ── Read file bytes ─────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const bytes       = new Uint8Array(arrayBuffer);

  // ── Magic-bytes MIME validation (security: prevent MIME spoofing) ────
  const detectedMime = detectMimeFromBytes(bytes);
  const declaredMime = file.type.split(";")[0].trim().toLowerCase();

  // Special case: RIFF container can be WAV or WebP — trust declared for RIFF
  const effectiveMime = detectedMime === "image/webm" && declaredMime === "audio/wav"
    ? "audio/wav"
    : detectedMime ?? declaredMime;

  // For video/mp4 the ftyp box check may not always match — allow declared if detected is null
  if (detectedMime && effectiveMime !== detectedMime &&
      !["video/mp4","video/quicktime","video/webm","audio/wav"].includes(declaredMime)) {
    return json({ ok: false, error: "mime_mismatch", detected: detectedMime }, 400, rawOrigin);
  }

  if (!ACCEPTED_MIME_TYPES.has(effectiveMime) && !ACCEPTED_MIME_TYPES.has(declaredMime)) {
    return json({ ok: false, error: "unsupported_type", type: effectiveMime }, 400, rawOrigin);
  }

  const finalMime = ACCEPTED_MIME_TYPES.has(effectiveMime) ? effectiveMime : declaredMime;

  // ── Hybrid A/B: inline ≤5MB, Files API for 5–10MB ───────────────────
  if (file.size <= INLINE_THRESHOLD) {
    // Option A: base64 inline
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return json({
      ok: true,
      attachment: {
        base64,
        mimeType:  finalMime,
        fileName:  file.name,
        sizeBytes: file.size,
      },
    }, 200, rawOrigin);
  }

  // Option B: Google Files API upload
  const fileUri = await uploadToGoogleFilesApi(bytes, finalMime, file.name);
  if (fileUri) {
    return json({
      ok: true,
      attachment: {
        fileUri,
        mimeType:  finalMime,
        fileName:  file.name,
        sizeBytes: file.size,
      },
    }, 200, rawOrigin);
  }

  // Fallback: inline even for large files (if Files API unavailable)
  const base64Fallback = Buffer.from(arrayBuffer).toString("base64");
  return json({
    ok: true,
    attachment: {
      base64:    base64Fallback,
      mimeType:  finalMime,
      fileName:  file.name,
      sizeBytes: file.size,
    },
  }, 200, rawOrigin);
}
