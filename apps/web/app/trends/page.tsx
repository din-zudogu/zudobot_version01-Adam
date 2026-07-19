import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const ADMIN_URL = "https://admin.zudogu.com/api/articles?channel=zudogu";

interface RemoteArticle {
  id?: string;
  title: string;
  content?: string;
  coverImage?: string | null;
  publishedAt?: string;
  createdAt?: string;
  channels?: string[];
}

interface TrendsArticle {
  id: string;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  slug: string;
  publishedAt: string;
  readTimeLabel: string;
}

export const metadata: Metadata = {
  title: "Trends — AI & Digital Insights | ZUDOGU",
  description:
    "บทความและข้อมูลเชิงลึกเกี่ยวกับ AI, การตลาดดิจิทัล และเทคโนโลยีสำหรับธุรกิจไทย โดยทีม ZUDOGU",
  alternates: { canonical: "https://www.zudogu.com/trends" },
  openGraph: {
    title: "Trends — AI & Digital Insights | ZUDOGU",
    description: "บทความและข้อมูลเชิงลึกเกี่ยวกับ AI และเทคโนโลยีสำหรับธุรกิจไทย",
    url: "https://www.zudogu.com/trends",
    type: "website",
  },
};

const trendsSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://www.zudogu.com/trends/#blog",
  name: "ZUDOGU Trends",
  description: "บทความและข้อมูลเชิงลึกเกี่ยวกับ AI และเทคโนโลยีสำหรับธุรกิจไทย",
  url: "https://www.zudogu.com/trends",
  publisher: {
    "@type": "Organization",
    name: "ZUDOGU",
    url: "https://www.zudogu.com",
  },
};

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

async function getArticles(): Promise<TrendsArticle[]> {
  try {
    const res = await fetch(ADMIN_URL, {
      next: { revalidate: 300, tags: ["zudogu-articles"] },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const raw: RemoteArticle[] = Array.isArray(data) ? data : [];
    return raw.map((a) => ({
      id:            a.id ?? "",
      title:         a.title ?? "",
      excerpt:       makeExcerpt(a.content ?? ""),
      thumbnail:     a.coverImage ?? null,
      slug:          a.id ?? "",
      publishedAt:   a.publishedAt ?? a.createdAt ?? new Date().toISOString(),
      readTimeLabel: estimateReadTime(a.content ?? ""),
    }));
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function TrendsPage() {
  const articles = await getArticles();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(trendsSchema) }}
      />
      <Header />
      <main className="min-h-screen">
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                Trends & Insights
              </p>
              <h1 className="font-heading text-5xl font-extrabold text-text-primary mb-4">
                AI & Digital Trends
              </h1>
              <p className="text-xl text-text-secondary max-w-2xl">
                บทความและข้อมูลเชิงลึกเกี่ยวกับ AI, การตลาดดิจิทัล และเทคโนโลยีสำหรับธุรกิจไทย
              </p>
            </div>

            {articles.length === 0 ? (
              <p className="text-text-muted text-sm py-12 text-center">
                ยังไม่มีบทความในขณะนี้
              </p>
            ) : (
              <div className="space-y-8">
                {articles.map((post) => (
                  <article
                    key={post.id}
                    className="card-premium p-8 hover:shadow-card-hover transition-shadow duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs text-text-muted">{post.readTimeLabel}</span>
                      <time dateTime={post.publishedAt} className="text-xs text-text-muted">
                        · {formatDate(post.publishedAt)}
                      </time>
                    </div>

                    <h2 className="font-heading text-2xl font-bold text-text-primary mb-3 leading-snug">
                      <Link
                        href={`/trends/${post.slug}`}
                        className="hover:text-brand-500 transition-colors duration-200"
                      >
                        {post.title}
                      </Link>
                    </h2>

                    {post.thumbnail && (
                      <img
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full rounded-lg mb-4 object-cover max-h-56"
                      />
                    )}

                    <p className="text-text-secondary leading-relaxed mb-5">{post.excerpt}</p>

                    <Link
                      href={`/trends/${post.slug}`}
                      className="inline-flex items-center gap-1 text-brand-500 font-medium text-sm hover:underline"
                    >
                      อ่านบทความ
                      <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
