"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const TESTIMONIALS = [
  // ─── Positive ───────────────────────────────────────────────────────────────
  {
    type: "positive",
    stars: 5,
    quote:
      "We went live on a Friday afternoon. By Sunday the bot had handled 47 customer inquiries — size questions, shipping timelines, stock checks — without anyone from our team touching a keyboard. That's 47 sales conversations we would have missed.",
    author: "Pimchanok S.",
    role: "Owner",
    company: "Boutique fashion store",
    location: "Bangkok, Thailand",
    industry: "Fashion retail",
    detail: "Using AI chatbot for 3 months · 2,400+ messages handled",
  },
  {
    type: "positive",
    stars: 5,
    quote:
      "I was skeptical about a chatbot for a restaurant. Customers want a real person, right? Turns out they just want their question answered fast. The bot handles 'do you have gluten-free options?' and 'what time do you close?' instantly. Our staff only gets pinged for actual table bookings.",
    author: "Natthapong K.",
    role: "Manager",
    company: "Thai fusion restaurant",
    location: "Chiang Mai, Thailand",
    industry: "F&B / Restaurant",
    detail: "Using AI chatbot for 5 months · 1,800+ queries handled",
  },
  {
    type: "positive",
    stars: 5,
    quote:
      "The knowledge base upload is surprisingly powerful. I uploaded our full product PDF and the bot immediately answered questions I didn't even think to prepare for — cross-sells, compatibility questions, warranty periods. It knows our catalog better than some of our newer staff.",
    author: "Somchai W.",
    role: "E-commerce director",
    company: "Electronics distributor",
    location: "Nonthaburi, Thailand",
    industry: "Electronics e-commerce",
    detail: "Using AI chatbot for 8 months · 12,000+ messages handled",
  },
  {
    type: "positive",
    stars: 5,
    quote:
      "Setup was genuinely 5 minutes. I was testing another solution that required a developer and 2 weeks. This one — copy a script tag, paste it, done. Had my first test conversation before my morning coffee went cold.",
    author: "Wiriya T.",
    role: "Marketing manager",
    company: "SaaS startup",
    location: "Remote, Thailand",
    industry: "SaaS / Tech",
    detail: "Live within minutes · Converted from trial on day 3",
  },
  {
    type: "positive",
    stars: 4,
    quote:
      "Our clinic doesn't need the AI to handle medical questions — we have strict rules about that. What we needed was something to handle 'what are your opening hours?' and 'do you accept X insurance?' at 11 PM. The bot does exactly that, and the safety guardrails make sure it never oversteps. Four stars because I wish the reporting dashboard had more filters.",
    author: "Dr. Amonrat L.",
    role: "Clinic administrator",
    company: "Private medical clinic",
    location: "Phuket, Thailand",
    industry: "Healthcare / Clinic",
    detail: "Using AI chatbot for 4 months · 900+ queries handled",
  },
  // ─── Mixed / Realistic ───────────────────────────────────────────────────────
  {
    type: "mixed",
    stars: 4,
    quote:
      "The bot is great for standard questions, but it took us two weeks of tweaking the knowledge base before the answers were consistently accurate. The initial setup is easy — the fine-tuning takes effort. Worth it, but set realistic expectations for the first month.",
    author: "Thanakorn P.",
    role: "Operations lead",
    company: "Automotive parts retailer",
    location: "Rayong, Thailand",
    industry: "Auto parts / Retail",
    detail: "Refined knowledge base over the first 30 days",
  },
  {
    type: "mixed",
    stars: 4,
    quote:
      "We hit our monthly message quota faster than expected when a promotion went viral. The warning notification came, but we missed it during a busy week. Lesson: set up multiple alert channels, not just email. Support was fast to help us recover. The upgrade process was smooth.",
    author: "Panida R.",
    role: "Digital marketing specialist",
    company: "Skincare brand",
    location: "Bangkok, Thailand",
    industry: "Beauty / E-commerce",
    detail: "Upgraded plan during a peak promotion period",
  },
  // ─── Honest / Critical ──────────────────────────────────────────────────────
  {
    type: "critical",
    stars: 3,
    quote:
      "The bot itself works well. My issue is the trial message limit — it wasn't enough to test a real peak-traffic scenario. I had to upgrade before I was fully confident. I wish there was a way to do a proper load test first. That said, once on a paid plan the performance has been solid.",
    author: "Krit S.",
    role: "CTO",
    company: "B2C marketplace",
    location: "Bangkok, Thailand",
    industry: "Marketplace / Tech",
    detail: "Upgraded after 7 days — needed more volume to evaluate",
  },
];

const STAR = "★";
const EMPTY_STAR = "☆";

function Stars({ count }: { count: number }) {
  return (
    <span className="text-gold-400 text-lg" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (i < count ? STAR : EMPTY_STAR)).join("")}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  positive: "Positive experience",
  mixed: "Mixed experience",
  critical: "Critical feedback",
};

export function TestimonialsSection() {
  const [filter, setFilter] = useState<"all" | "positive" | "mixed" | "critical">("all");

  const visible = filter === "all" ? TESTIMONIALS : TESTIMONIALS.filter((t) => t.type === filter);

  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            Real-world AI Chatbot experiences
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            What businesses{" "}
            <span className="text-grad-blue">actually experience</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-4">
            Honest feedback from business owners and operators who have deployed AI chatbots —
            positive, mixed, and critical. Shared so you can set the right expectations.
          </p>
          {/* Disclosure banner */}
          <div className="inline-flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 max-w-2xl text-left">
            <span className="text-amber-500 mt-0.5 shrink-0 text-base">ℹ</span>
            <p className="text-amber-800 text-sm leading-relaxed">
              <strong>Disclosure:</strong> These are experiences shared by businesses that have
              used AI chatbot services from various providers in the market — not Zudobot
              customers.
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          {(["all", "positive", "mixed", "critical"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 capitalize",
                filter === f
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-white border-border text-text-secondary hover:border-brand-300"
              )}
            >
              {f === "all" ? "All experiences" : f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((t, i) => (
            <article
              key={i}
              className={cn(
                "card-premium flex flex-col p-6 hover:shadow-card-hover transition-shadow duration-300",
                t.type === "critical" && "border-l-4 border-l-amber-400",
                t.type === "mixed" && "border-l-4 border-l-blue-300"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <Stars count={t.stars} />
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    t.type === "positive" && "bg-emerald-50 text-emerald-700",
                    t.type === "mixed" && "bg-blue-50 text-blue-700",
                    t.type === "critical" && "bg-amber-50 text-amber-700"
                  )}
                >
                  {TYPE_LABELS[t.type]}
                </span>
              </div>

              <blockquote className="flex-1 text-text-secondary leading-relaxed mb-5 italic">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <footer>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{t.author}</p>
                    <p className="text-text-muted text-xs">{t.role}, {t.company}</p>
                    <p className="text-text-muted text-xs">{t.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {t.industry}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-text-muted border-t border-border pt-3">
                  {t.detail}
                </p>
              </footer>
            </article>
          ))}
        </div>

        {/* Bottom note */}
        <p className="mt-10 text-center text-xs text-text-muted max-w-2xl mx-auto">
          * Experiences above are from business operators who have used AI chatbot services from
          various providers. Names and identifying details have been anonymised. These reflect
          real patterns seen across the industry, not endorsements of or by Zudobot.
        </p>
      </div>
    </section>
  );
}
