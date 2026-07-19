import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ArticleModel } from "@/lib/db/models/Article";

export interface PublicArticle {
  id:            string;
  title:         string;
  excerpt:       string;
  category:      string;
  thumbnail:     string | null;
  slug:          string;
  publishedAt:   string;
  readTimeLabel: string;
  channels:      string[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q       = (searchParams.get("q")       ?? "").toLowerCase().trim();
  const channel = (searchParams.get("channel") ?? "").trim();

  try {
    await connectDB();

    const filter: Record<string, unknown> = { status: "published" };
    const andClauses: Record<string, unknown>[] = [];

    // Channel filter: match articles assigned to this channel OR articles with no
    // channel restriction (empty channels array = global, shown everywhere).
    if (channel) {
      andClauses.push({
        $or: [
          { channels: channel },
          { channels: { $size: 0 } },
        ],
      });
    }

    if (q) {
      andClauses.push({
        $or: [
          { title:    { $regex: q, $options: "i" } },
          { excerpt:  { $regex: q, $options: "i" } },
          { category: { $regex: q, $options: "i" } },
        ],
      });
    }

    if (andClauses.length > 0) filter.$and = andClauses;

    const raw = await ArticleModel
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();

    const articles: PublicArticle[] = raw.map((a) => ({
      id:            a._id.toString(),
      title:         a.title,
      excerpt:       a.excerpt,
      category:      a.category,
      thumbnail:     a.thumbnail ?? null,
      slug:          a.slug,
      publishedAt:   (a.publishedAt ?? a.createdAt).toISOString(),
      readTimeLabel: a.readTimeLabel,
      channels:      a.channels ?? [],
    }));

    return NextResponse.json({ articles }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[public/articles]", msg);
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}
