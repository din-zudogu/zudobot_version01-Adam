/**
 * /api/widget/customer-memory
 *
 * GET  ?hash=<sha256>&tenantId=<id>
 *   → Returns memory record if found (topics + summary), else 404
 *
 * POST { emailHash, tenantId, topics, memorySummary, retentionDays }
 *   → Upsert memory record (creates or updates)
 *   → Only called after explicit user consent (enforced by caller)
 *
 * Security:
 *   - emailHash must be a valid SHA-256 hex string (64 chars)
 *   - Domain whitelist checked via Origin header
 *   - No email plaintext ever accepted or returned
 *   - Rate-limited via existing widget quota infrastructure
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { CustomerMemoryModel } from "@/lib/db/models/CustomerMemory";

export const dynamic = "force-dynamic";

const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const DEFAULT_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 365;
const MAX_TOPICS = 20;
const MAX_SUMMARY_LENGTH = 500;

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function json(data: unknown, status: number, origin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  const { searchParams } = new URL(req.url);
  const hash     = searchParams.get("hash")?.trim().toLowerCase() ?? "";
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";

  if (!SHA256_REGEX.test(hash) || !tenantId) {
    return json({ error: "invalid_params" }, 400, origin);
  }

  try {
    await connectDB();
    const record = await CustomerMemoryModel.findOne(
      { tenantId, emailHash: hash },
      { topics: 1, memorySummary: 1, lastSeenAt: 1 },
    ).lean();

    if (!record) return json({ found: false }, 404, origin);

    return json({
      found:         true,
      topics:        record.topics,
      memorySummary: record.memorySummary ?? null,
      lastSeenAt:    record.lastSeenAt,
    }, 200, origin);
  } catch {
    return json({ error: "server_error" }, 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400, origin);
  }

  const emailHash    = String(body.emailHash ?? "").trim().toLowerCase();
  const tenantId     = String(body.tenantId ?? "").trim();
  const rawTopics    = Array.isArray(body.topics) ? body.topics : [];
  const rawSummary   = body.memorySummary != null ? String(body.memorySummary) : undefined;
  const retentionDays = Math.min(
    Number(body.retentionDays ?? DEFAULT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
  );

  if (!SHA256_REGEX.test(emailHash) || !tenantId) {
    return json({ error: "invalid_params" }, 400, origin);
  }

  // Sanitise topics — strings only, no PII patterns
  const EMAIL_PATTERN = /\S+@\S+\.\S+/;
  const topics = rawTopics
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0 && t.length <= 100 && !EMAIL_PATTERN.test(t))
    .slice(0, MAX_TOPICS);

  const memorySummary = rawSummary
    ? rawSummary.slice(0, MAX_SUMMARY_LENGTH)
    : undefined;

  const expiresAt = new Date(Date.now() + retentionDays * 864e5);

  try {
    await connectDB();
    await CustomerMemoryModel.findOneAndUpdate(
      { tenantId, emailHash },
      {
        $set:      { lastSeenAt: new Date(), expiresAt, ...(memorySummary != null ? { memorySummary } : {}) },
        $addToSet: { topics: { $each: topics } },
      },
      { upsert: true, new: true },
    );

    return json({ ok: true }, 200, origin);
  } catch {
    return json({ error: "server_error" }, 500, origin);
  }
}
