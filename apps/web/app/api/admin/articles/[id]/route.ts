import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ArticleModel } from "@/lib/db/models/Article";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.title         !== undefined) updates.title         = body.title.trim();
  if (body.excerpt       !== undefined) updates.excerpt       = body.excerpt.trim();
  if (body.content       !== undefined) updates.content       = body.content;
  if (body.category      !== undefined) updates.category      = body.category.trim();
  if (body.thumbnail     !== undefined) updates.thumbnail     = body.thumbnail?.trim() || null;
  if (body.readTimeLabel !== undefined) updates.readTimeLabel = body.readTimeLabel.trim();
  if (body.slug          !== undefined) updates.slug          = body.slug.trim();

  if (body.status !== undefined) {
    updates.status = body.status === "published" ? "published" : "draft";
    if (updates.status === "published" && body.setPublishedAt !== false) {
      updates.publishedAt = new Date();
    }
  }
  if (body.channels !== undefined) {
    updates.channels = Array.isArray(body.channels)
      ? body.channels.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
  }

  try {
    await connectDB();
    const article = await ArticleModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();

    if (!article) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, article });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/articles PUT]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    await connectDB();
    const article = await ArticleModel.findByIdAndDelete(id).lean();
    if (!article) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/articles DELETE]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
