import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const ADMIN_BASE = "https://admin.zudogu.com/api/articles";

interface RemoteArticle {
  id?: string;
  title: string;
  content?: string;
  coverImage?: string | null;
  publishedAt?: string;
  createdAt?: string;
  channels?: string[];
}

async function getArticle(slug: string): Promise<RemoteArticle | null> {
  try {
    const res = await fetch(`${ADMIN_BASE}/${slug}`, {
      next: { revalidate: 300, tags: ["zudogu-articles"] },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  const description = (article.content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return {
    title: `${article.title} | ZUDOGU Trends`,
    description: description || article.title,
    alternates: { canonical: `https://www.zudogu.com/trends/${slug}` },
    openGraph: {
      title: article.title,
      description: description || article.title,
      url: `https://www.zudogu.com/trends/${slug}`,
      type: "article",
      publishedTime: article.publishedAt ?? article.createdAt,
      ...(article.coverImage ? { images: [{ url: article.coverImage }] } : {}),
    },
  };
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

export default async function TrendsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const publishedAt = article.publishedAt ?? article.createdAt ?? new Date().toISOString();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://www.zudogu.com/trends/${slug}`,
    headline: article.title,
    datePublished: publishedAt,
    url: `https://www.zudogu.com/trends/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "ZUDOGU",
      url: "https://www.zudogu.com",
    },
    ...(article.coverImage ? { image: article.coverImage } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Header />
      <main className="min-h-screen bg-white">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <Link
            href="/trends"
            className="inline-flex items-center gap-1 text-brand-500 text-sm font-medium mb-10 hover:underline"
          >
            ← กลับ Trends
          </Link>

          {article.coverImage && (
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full rounded-xl mb-10 object-cover max-h-96"
            />
          )}

          <header className="mb-10">
            <h1 className="font-heading text-4xl font-extrabold text-text-primary leading-tight mb-4">
              {article.title}
            </h1>
            <time dateTime={publishedAt} className="text-text-muted text-sm">
              {formatDate(publishedAt)}
            </time>
          </header>

          {article.content ? (
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
            <p className="text-text-muted">ไม่พบเนื้อหาบทความ</p>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}
