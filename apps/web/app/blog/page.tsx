import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import type { PublicArticle } from "@/app/api/public/articles/route";
import { connectDB } from "@/lib/db/connect";
import { ArticleModel } from "@/lib/db/models/Article";

export const metadata: Metadata = {
  title: "Blog — AI Sales & Chatbot Strategy",
  description:
    "Practical guides on AI sales agents, chatbot strategy, and how to convert more customers with automation. By the Zudobot team.",
  alternates: { canonical: "https://zudobot.zudogu.com/blog" },
  openGraph: {
    title: "Blog — AI Sales & Chatbot Strategy | ZUDOBOT",
    description: "Practical guides on AI sales agents, chatbot strategy, and customer automation.",
    url: "https://zudobot.zudogu.com/blog",
    type: "website",
  },
};

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://zudobot.zudogu.com/blog/#blog",
  name: "ZUDOBOT Blog",
  description: "Practical guides on AI sales agents, chatbot strategy, and customer automation.",
  url: "https://zudobot.zudogu.com/blog",
  publisher: {
    "@type": "Organization",
    name: "ZUDOGU",
    url: "https://zudobot.zudogu.com",
  },
};

async function getArticles(): Promise<PublicArticle[]> {
  try {
    await connectDB();
    const raw = await ArticleModel
      .find({
        status: "published",
        $or: [{ channels: "www.zudobot.zudogu.com" }, { channels: { $size: 0 } }],
      })
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();
    return raw.map((a) => ({
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
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function BlogIndexPage() {
  const articles = await getArticles();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <Header />
      <main className="min-h-screen">
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                From the ZUDOBOT team
              </p>
              <h1 className="font-heading text-5xl font-extrabold text-text-primary mb-4">
                AI Sales & Chatbot Strategy
              </h1>
              <p className="text-xl text-text-secondary max-w-2xl">
                Practical guides on how AI sales agents work, what makes chatbots fail, and how to
                convert more customers with automation.
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
                      <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider bg-brand-50 px-2.5 py-1 rounded-full">
                        {post.category}
                      </span>
                      <span className="text-xs text-text-muted">{post.readTimeLabel}</span>
                      <time dateTime={post.publishedAt} className="text-xs text-text-muted">
                        · {formatDate(post.publishedAt)}
                      </time>
                    </div>

                    <h2 className="font-heading text-2xl font-bold text-text-primary mb-3 leading-snug">
                      <Link
                        href={`https://www.zudogu.com/trends/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brand-500 transition-colors duration-200"
                      >
                        {post.title}
                      </Link>
                    </h2>

                    <p className="text-text-secondary leading-relaxed mb-5">{post.excerpt}</p>

                    <Link
                      href={`https://www.zudogu.com/trends/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-500 font-medium text-sm hover:underline"
                    >
                      Read article
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
