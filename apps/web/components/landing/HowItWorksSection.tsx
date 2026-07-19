"use client";

const STEPS = [
  {
    number: "01",
    icon: "📋",
    title: "Create your account",
    description:
      "Sign up with Google in 10 seconds. No credit card. Your 14-day trial starts immediately with 250 messages per day to test everything.",
    detail: "Sign in → name your bot → choose industry → done.",
  },
  {
    number: "02",
    icon: "📚",
    title: "Upload your knowledge base",
    description:
      "Paste product URLs, upload PDFs, Excel files, or type directly. Zudobot reads your catalog, prices, promotions, and FAQs — and knows them immediately.",
    detail: "Supported: PDF, Excel, Word, CSV, plain text, URLs.",
  },
  {
    number: "03",
    icon: "⚙️",
    title: "Configure your bot personality",
    description:
      "Give your bot a name and tone. Set Constitutional Rules — forbidden topics, max discount percentage, escalation triggers. The AI stays on-brand automatically.",
    detail: "Tone options: friendly, professional, concise, warm.",
  },
  {
    number: "04",
    icon: "🔗",
    title: "Embed on your site in one line",
    description:
      "Copy one JavaScript snippet from the Dashboard and paste it before the closing </body> tag. No developer needed. Works on any website, Shopify, WordPress, or custom stack.",
    detail: "SRI-verified script. Loads asynchronously — zero CLS impact.",
  },
  {
    number: "05",
    icon: "📈",
    title: "Watch it serve customers 24/7",
    description:
      "Your bot answers questions, recommends products, detects buying intent, and collects leads — day and night. You get LINE notifications when a human should step in.",
    detail: "Dashboard shows conversations, intent signals, and quota usage in real time.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
            How it works
          </p>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4 text-balance">
            From signup to{" "}
            <span className="text-grad-blue">live in 10 minutes</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Five steps. No developers. No long onboarding. Just a bot that knows
            your catalog and serves your customers.
          </p>
        </div>

        <div className="relative">
          <div
            className="absolute left-8 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-brand-100 via-brand-300 to-transparent hidden sm:block"
            aria-hidden="true"
          />

          <ol className="space-y-12">
            {STEPS.map((step, i) => (
              <li
                key={step.number}
                className={`relative flex flex-col sm:flex-row gap-6 sm:gap-10 items-start ${
                  i % 2 === 1 ? "sm:flex-row-reverse" : ""
                }`}
              >
                <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-brand-500 text-white font-heading font-extrabold text-sm items-center justify-center shadow-lg z-10">
                  {step.number}
                </div>

                <div className={`flex-1 ${i % 2 === 1 ? "sm:text-right" : ""}`}>
                  <div
                    className={`card-premium p-7 hover:shadow-card-hover transition-shadow duration-300 ${
                      i % 2 === 1 ? "sm:ml-12" : "sm:mr-12"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl shrink-0">{step.icon}</div>
                      <div>
                        <div className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1 sm:hidden">
                          Step {step.number}
                        </div>
                        <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                          {step.title}
                        </h3>
                        <p className="text-text-secondary leading-relaxed mb-3">
                          {step.description}
                        </p>
                        <p className="text-sm text-text-muted border-l-2 border-brand-200 pl-3">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 hidden sm:block" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 card-premium bg-gradient-to-r from-brand-50 to-cyan-50 border-brand-100 p-8 text-center">
          <p className="text-text-secondary text-lg mb-1">
            Average setup time from signup to first live conversation:
          </p>
          <p className="font-heading text-5xl font-extrabold text-grad-blue">
            8 minutes
          </p>
          <p className="text-text-muted text-sm mt-2">
            Based on onboarding data from active Zudobot tenants
          </p>
        </div>
      </div>
    </section>
  );
}
