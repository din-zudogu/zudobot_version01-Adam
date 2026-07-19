"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const USE_CASES = [
  {
    id: "ecommerce",
    icon: "🛍️",
    industry: "E-commerce & Fashion",
    headline: "Turn browsing into buying — automatically",
    challenge:
      "Customers abandon carts because they have unanswered questions about size, stock, or shipping. Your support team is overloaded and can't respond at 2 AM.",
    solution:
      "Zudobot answers size guides, stock availability, and shipping timelines instantly — 24 hours a day. It detects buying intent ('does this come in blue?') and proactively suggests the right product.",
    results: [
      "Customers get answers in under 3 seconds",
      "Cart abandonment questions resolved automatically",
      "Late-night sales captured while you sleep",
      "Human agents only handle escalations",
    ],
    quote:
      "We used to miss 40% of weekend inquiries. Now the bot handles them all and we see it in the orders on Monday morning.",
    quoteAuthor: "Fashion store owner, Bangkok",
    color: "from-pink-50 to-rose-50",
    border: "border-pink-100",
    accent: "text-pink-600",
  },
  {
    id: "restaurant",
    icon: "🍜",
    industry: "Restaurant & Food",
    headline: "Fill tables and take orders — without a phone team",
    challenge:
      "Your staff spends half their shift answering the same questions: opening hours, menu items, allergens, and reservation availability. Peak-hour calls go unanswered.",
    solution:
      "Zudobot knows your full menu, allergy info, daily specials, and reservation rules. Customers ask on your website or LINE — the bot answers and guides them to book.",
    results: [
      "Menu and allergen questions answered 24/7",
      "Reservation inquiries handled without staff involvement",
      "Daily specials updated in the knowledge base in minutes",
      "Peak-hour overwhelm eliminated",
    ],
    quote:
      "We stopped missing reservation calls on Saturday nights. The bot takes the inquiry and we confirm via LINE. Simple.",
    quoteAuthor: "Restaurant manager, Chiang Mai",
    color: "from-orange-50 to-amber-50",
    border: "border-orange-100",
    accent: "text-orange-600",
  },
  {
    id: "clinic",
    icon: "🏥",
    industry: "Clinic & Healthcare",
    headline: "Answer patient questions without exposing sensitive data",
    challenge:
      "Patients ask about treatment options, pricing, and appointment availability at all hours. Staff can't respond to every pre-visit inquiry while managing in-clinic patients.",
    solution:
      "Zudobot handles general service inquiries, pricing ranges, and appointment scheduling prompts — without accessing or disclosing any patient records. Constitutional Rules enforce strict topic boundaries.",
    results: [
      "General service questions answered 24/7",
      "Pricing and availability info delivered instantly",
      "No medical records or PII ever exposed",
      "Staff focus on in-clinic patients, not phone calls",
    ],
    quote:
      "Patients now come in already knowing what to expect. The bot filters the easy questions so we can focus on actual care.",
    quoteAuthor: "Clinic administrator, Phuket",
    color: "from-teal-50 to-cyan-50",
    border: "border-teal-100",
    accent: "text-teal-600",
  },
  {
    id: "software",
    icon: "💻",
    industry: "Software & SaaS",
    headline: "Self-serve support that scales without hiring",
    challenge:
      "Your documentation is thorough but hard to navigate. Prospects ask the same pre-sales questions over and over. Support tickets eat engineering time.",
    solution:
      "Zudobot ingests your docs, changelogs, and pricing pages. It handles 'how do I integrate X?' and 'what plan do I need for Y?' questions — qualifying leads and deflecting Level-1 tickets simultaneously.",
    results: [
      "Pre-sales questions answered without sales team involvement",
      "Documentation search replaced with conversational answers",
      "Level-1 support deflection without additional hires",
      "Leads qualified and escalated to sales at the right moment",
    ],
    quote:
      "Our trial-to-paid conversion improved because leads were better informed before their first sales call. The bot did that.",
    quoteAuthor: "Head of Growth, B2B SaaS company",
    color: "from-indigo-50 to-blue-50",
    border: "border-indigo-100",
    accent: "text-indigo-600",
  },
];

export function UseCasesSection() {
  const [active, setActive] = useState(0);
  const uc = USE_CASES[active];

  return (
    <section id="use-cases" className="py-24 bg-surface-secondary">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            Use cases
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            Works for{" "}
            <span className="text-grad-gold">every industry</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            One platform, multiple industries. The same bot infrastructure adapts
            to your catalog, tone, and customer expectations.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {USE_CASES.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full border font-medium text-sm transition-all duration-200",
                active === i
                  ? "bg-brand-500 border-brand-500 text-white shadow-md"
                  : "bg-white border-border text-text-secondary hover:border-brand-300 hover:text-text-primary"
              )}
            >
              <span>{u.icon}</span>
              {u.industry.split(" ")[0]}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "card-premium bg-gradient-to-br border p-8 sm:p-10 transition-all duration-300",
            uc.color,
            uc.border
          )}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <div className="text-5xl mb-4">{uc.icon}</div>
              <p className={cn("text-xs font-semibold uppercase tracking-widest mb-2", uc.accent)}>
                {uc.industry}
              </p>
              <h3 className="font-heading text-2xl sm:text-3xl font-extrabold text-text-primary mb-4">
                {uc.headline}
              </h3>

              <div className="mb-5">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  The challenge
                </p>
                <p className="text-text-secondary leading-relaxed">{uc.challenge}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  The solution
                </p>
                <p className="text-text-secondary leading-relaxed">{uc.solution}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-8">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  What changes
                </p>
                <ul className="space-y-2.5">
                  {uc.results.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-text-secondary">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <blockquote className="bg-white/60 rounded-xl p-5 border border-white/80">
                <p className="text-text-primary leading-relaxed mb-3 italic">
                  &ldquo;{uc.quote}&rdquo;
                </p>
                <footer className="text-sm text-text-muted font-medium">
                  — {uc.quoteAuthor}
                </footer>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
