"use client";

import { useEffect, useRef, useState } from "react";

const TRENDS_URL = "https://www.zudogu.com/trends/";

interface PublicArticle {
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

function ArticleSkeleton() {
  return (
    <div className="card-premium p-7 flex flex-col gap-4 animate-pulse">
      <div className="flex gap-3">
        <div className="h-5 w-20 rounded-full bg-surface-secondary" />
        <div className="h-5 w-16 rounded-full bg-surface-secondary" />
      </div>
      <div className="space-y-2 flex-1">
        <div className="h-5 w-full rounded bg-surface-secondary" />
        <div className="h-5 w-4/5 rounded bg-surface-secondary" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3.5 w-full rounded bg-surface-secondary" />
        <div className="h-3.5 w-11/12 rounded bg-surface-secondary" />
        <div className="h-3.5 w-3/4 rounded bg-surface-secondary" />
      </div>
      <div className="flex justify-between border-t border-border pt-4">
        <div className="h-3 w-24 rounded bg-surface-secondary" />
        <div className="h-3 w-20 rounded bg-surface-secondary" />
      </div>
    </div>
  );
}

export function BlogPreviewSection() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = debouncedQuery
      ? `/api/public/articles?q=${encodeURIComponent(debouncedQuery)}`
      : "/api/public/articles";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setArticles(data.articles ?? []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const displayed = articles.slice(0, 4);

  return (
    <section id="blog" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
              From the blog
            </p>
            <h2 className="font-heading text-4xl font-extrabold text-text-primary">
              Learn how AI sales works
            </h2>
          </div>
          <a
            href={TRENDS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 font-medium text-sm hover:underline shrink-0 self-end"
          >
            อ่านบทความอื่นๆ →
          </a>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาบทความ..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface-primary text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
            />
          </div>
        </div>

        {/* Articles grid — 1 row, max 4 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <ArticleSkeleton key={i} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-sm">
            {query ? `ไม่พบบทความที่ตรงกับ "${query}"` : "ยังไม่มีบทความในขณะนี้"}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayed.map((article) => (
              <article
                key={article.id}
                className="card-premium p-6 flex flex-col hover:shadow-card-hover transition-shadow duration-300"
              >
                {/* Thumbnail */}
                {article.thumbnail && (
                  <div className="mb-4 rounded-lg overflow-hidden aspect-video bg-surface-secondary">
                    <img
                      src={article.thumbnail}
                      alt={article.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded-full">
                    {article.category}
                  </span>
                  <span className="text-xs text-text-muted">{article.readTimeLabel}</span>
                </div>

                {/* Title */}
                <h3 className="font-heading text-base font-bold text-text-primary mb-2 leading-snug flex-1">
                  <a
                    href={`https://www.zudogu.com/trends/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-500 transition-colors duration-200"
                  >
                    {article.title}
                  </a>
                </h3>

                {/* Excerpt */}
                <p className="text-text-secondary text-xs leading-relaxed mb-4 line-clamp-3">
                  {article.excerpt}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
                  <time
                    dateTime={article.publishedAt}
                    className="text-xs text-text-muted"
                  >
                    {formatDate(article.publishedAt)}
                  </time>
                  <a
                    href={`https://www.zudogu.com/trends/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-500 font-medium hover:underline"
                  >
                    อ่านบทความ →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <a
            href={TRENDS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors duration-200 shadow-sm"
          >
            อ่านบทความอื่นๆ ทั้งหมด →
          </a>
        </div>
      </div>
    </section>
  );
}
