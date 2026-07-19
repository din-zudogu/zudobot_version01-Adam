import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ArticleModel } from "@/lib/db/models/Article";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    await connectDB();
    const filter = status ? { status } : {};
    const articles = await ArticleModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ articles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/articles GET]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const title         = body.title?.trim();
  const excerpt       = body.excerpt?.trim();
  const content       = body.content?.trim() ?? "";
  const category      = body.category?.trim();
  const thumbnail     = body.thumbnail?.trim() || null;
  const readTimeLabel = body.readTimeLabel?.trim() || "อ่าน";
  const status        = body.status === "published" ? "published" : "draft";
  const slug          = body.slug?.trim() || slugify(title ?? "");
  const channels: string[] = Array.isArray(body.channels)
    ? body.channels.map((c: unknown) => String(c).trim()).filter(Boolean)
    : [];

  if (!title || !excerpt || !category || !slug) {
    return NextResponse.json({ error: "title, excerpt, category and slug are required" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await ArticleModel.findOne({ slug }).lean();
    if (existing) {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }

    const publishedAt = status === "published" ? new Date() : null;

    const article = await ArticleModel.create({
      title,
      slug,
      excerpt,
      content,
      category,
      thumbnail,
      status,
      readTimeLabel,
      publishedAt,
      channels,
      createdBy: token.sub ?? "admin",
    });

    return NextResponse.json({ ok: true, article }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/articles POST]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
