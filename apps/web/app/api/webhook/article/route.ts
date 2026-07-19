import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { connectDB } from "@/lib/db/connect";
import { ArticleModel } from "@/lib/db/models/Article";

// ── Types ────────────────────────────────────────────────────────────────────

/** Payload ที่ส่งมาจาก admin.zudogu.com (broadcast.ts) */
type AdminArticlePayload = {
  id:           string;
  title:        string;
  author?:      string | null;
  content?:     string;
  coverImage?:  string | null;
  channels?:    string[];         // channel IDs: ["trends", "zudobot", "www"]
  publishedAt?: string;
  createdAt?:   string;
};

/** Payload ที่สร้างตรงจาก Zudobot Admin (มี slug ครบ) */
type NativeArticlePayload = {
  slug:          string;
  title?:        string;
  excerpt?:      string;
  content?:      string;
  category?:     string;
  thumbnail?:    string | null;
  readTimeLabel?: string;
  publishedAt?:  string;
  createdBy?:    string;
  channels?:     string[];
};

type ArticlePayload = AdminArticlePayload | NativeArticlePayload;

// ── Channel ID → Label map ───────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  www:     "www.zudogu.com",
  trends:  "www.zudogu.com/trends",
  zudobot: "zudobot.zudogu.com",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function secretsMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function makeExcerpt(html: string, maxLen = 200): string {
  const text = stripHtml(html);
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

function estimateReadTime(html: string): string {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** แปลง channel IDs → labels ถ้ายังไม่ใช่ label */
function resolveChannels(channels: string[]): string[] {
  return channels.map((ch) => CHANNEL_LABELS[ch] ?? ch);
}

/** ตรวจว่าเป็น admin payload (มี id แต่ไม่มี slug) */
function isAdminPayload(p: ArticlePayload): p is AdminArticlePayload {
  return "id" in p && !("slug" in p);
}

/** แปลง admin payload → format ที่ MongoDB ต้องการ */
function normalizeAdminPayload(raw: AdminArticlePayload) {
  return {
    slug:          raw.id,
    title:         raw.title,
    excerpt:       makeExcerpt(raw.content ?? ""),
    content:       raw.content ?? "",
    category:      "บทความ",
    thumbnail:     raw.coverImage ?? null,
    readTimeLabel: estimateReadTime(raw.content ?? ""),
    publishedAt:   raw.publishedAt ? new Date(raw.publishedAt) : new Date(),
    createdBy:     raw.author ?? "ZUDOGU Admin",
    channels:      resolveChannels(raw.channels ?? []),
  };
}

/** แปลง native payload → format ที่ MongoDB ต้องการ */
function normalizeNativePayload(raw: NativeArticlePayload) {
  return {
    slug:          raw.slug,
    title:         raw.title ?? "",
    excerpt:       raw.excerpt ?? makeExcerpt(raw.content ?? ""),
    content:       raw.content ?? "",
    category:      raw.category ?? "บทความ",
    thumbnail:     raw.thumbnail ?? null,
    readTimeLabel: raw.readTimeLabel ?? estimateReadTime(raw.content ?? ""),
    publishedAt:   raw.publishedAt ? new Date(raw.publishedAt) : new Date(),
    createdBy:     raw.createdBy ?? "webhook",
    channels:      resolveChannels(raw.channels ?? []),
  };
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidateTag("articles");
  revalidateTag("zudobot-articles");
  revalidateTag("zudogu-articles");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const expected = AMPLIFY_CONFIG.webhookSecret;
  const incoming = req.headers.get("x-webhook-secret") ?? "";

  if (!expected || !secretsMatch(incoming, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { event?: string; article?: ArticlePayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, article } = body;

  if (event === "article.published") {
    if (!article) {
      return NextResponse.json({ error: "Missing article" }, { status: 400 });
    }

    const data = isAdminPayload(article)
      ? normalizeAdminPayload(article)
      : normalizeNativePayload(article);

    if (!data.slug) {
      return NextResponse.json({ error: "Cannot resolve slug" }, { status: 400 });
    }

    await connectDB();

    await ArticleModel.findOneAndUpdate(
      { slug: data.slug },
      { $set: { ...data, status: "published" } },
      { upsert: true }
    );

    revalidateAll();

    console.info("[webhook/article] published slug=%s", data.slug);
    return NextResponse.json({ ok: true, action: "upserted", slug: data.slug });
  }

  if (event === "article.unpublished" || event === "article.deleted") {
    if (!article) {
      return NextResponse.json({ error: "Missing article" }, { status: 400 });
    }

    const slug = isAdminPayload(article) ? article.id : (article as NativeArticlePayload).slug;

    if (!slug) {
      return NextResponse.json({ error: "Cannot resolve slug" }, { status: 400 });
    }

    await connectDB();

    await ArticleModel.findOneAndUpdate(
      { slug },
      { $set: { status: "draft", publishedAt: null } }
    );

    revalidateAll();

    console.info("[webhook/article] %s slug=%s", event, slug);
    return NextResponse.json({ ok: true, action: "unpublished" });
  }

  return NextResponse.json({ ok: true, action: "ignored" });
}
