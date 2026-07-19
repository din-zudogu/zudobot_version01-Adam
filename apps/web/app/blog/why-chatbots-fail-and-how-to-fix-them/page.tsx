import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Why Chatbots Fail (And What to Do About It)",
  description:
    "80% of chatbot deployments underperform within 6 months. The causes are predictable — bad knowledge bases, no fallback, wrong tone. This article diagnoses the most common failures and the fix for each.",
  alternates: {
    canonical: "https://zudobot.zudogu.com/blog/why-chatbots-fail-and-how-to-fix-them",
  },
  openGraph: {
    title: "Why Chatbots Fail (And What to Do About It)",
    description:
      "The six most common chatbot failures — and exactly what to do about each one.",
    url: "https://zudobot.zudogu.com/blog/why-chatbots-fail-and-how-to-fix-them",
    type: "article",
    publishedTime: "2026-06-03T00:00:00Z",
    authors: ["ZUDOBOT Team"],
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "https://zudobot.zudogu.com/blog/why-chatbots-fail-and-how-to-fix-them/#article",
  headline: "Why Chatbots Fail (And What to Do About It)",
  description:
    "80% of chatbot deployments underperform within 6 months. The causes are predictable — bad knowledge bases, no fallback, wrong tone.",
  datePublished: "2026-06-03T00:00:00Z",
  dateModified: "2026-06-03T00:00:00Z",
  author: {
    "@type": "Organization",
    name: "ZUDOBOT Team",
    url: "https://zudobot.zudogu.com",
  },
  publisher: {
    "@type": "Organization",
    name: "ZUDOGU",
    url: "https://zudobot.zudogu.com",
    logo: {
      "@type": "ImageObject",
      url: "https://zudobot.zudogu.com/logo.png",
    },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://zudobot.zudogu.com/blog/why-chatbots-fail-and-how-to-fix-them",
  },
  isPartOf: {
    "@type": "Blog",
    "@id": "https://zudobot.zudogu.com/blog/#blog",
  },
};

const FAILURES = [
  {
    number: "01",
    title: "The knowledge base is incomplete or out of date",
    symptom:
      "The bot gives wrong answers, confidently. Customers get incorrect prices, stale stock info, or outdated promotions. They stop trusting it after the first wrong answer.",
    cause:
      "The knowledge base was loaded once at setup and never updated. Products changed. Promotions ended. Prices shifted. The bot didn't know.",
    fix: "Treat the knowledge base as a living document, not a one-time upload. Every time your catalog changes, update the KB. Use Zudobot's re-index feature to push changes immediately. Build a habit: whenever marketing publishes a new promo, the KB gets updated the same day.",
    severity: "critical",
  },
  {
    number: "02",
    title: "No escalation path — the bot is a dead end",
    symptom:
      "Customers get frustrated and just leave. They never reach a human. The company sees high chat abandonment but doesn't understand why.",
    cause:
      "The chatbot was built as a replacement for human support, not a filter. When it can't answer, it has no way to pass the conversation along.",
    fix: "Every chatbot needs a clear fallback: LINE notification, email, live chat handoff, or at minimum 'I'll have a team member reach out to you.' Constitutional Rules in Zudobot let you define exactly when the bot should escalate — by topic, by question complexity, or by customer signal. The bot that says 'I'm not the right resource for this — let me connect you with someone who is' has a better conversion rate than one that keeps guessing.",
    severity: "critical",
  },
  {
    number: "03",
    title: "The bot tone doesn't match the brand",
    symptom:
      "Customers find the bot cold, generic, or confusingly formal (or informal) compared to your brand voice. Engagement drops after the first message.",
    cause:
      "Default chatbot personas are neutral. Neutral is invisible. A fashion brand with a fun, playful voice needs a bot that matches. A medical clinic needs a professional, reassuring tone. Most deployments use whatever default came in the box.",
    fix: "Configure a clear persona: give the bot a name, define its tone (friendly, concise, professional, warm), and write a brief personality guide in the system prompt. Test with 10 realistic customer questions and review the answers as if you were the customer. Adjust until the voice feels consistent with the rest of your customer experience.",
    severity: "high",
  },
  {
    number: "04",
    title: "The bot is placed somewhere customers don't look",
    symptom:
      "The bot exists, but almost no one uses it. Traffic metrics show visits but no chat initiations.",
    cause:
      "The widget was embedded on the homepage and forgotten. Customers don't look for chat on a homepage — they look for it when they have a specific question, usually on a product page, checkout page, or contact page.",
    fix: "Embed the widget on high-intent pages: product detail pages, pricing pages, checkout flows, and the contact page. These are where customers have questions. Add a proactive open trigger after 30 seconds on a product page with a message like 'Have a question about this? I can help.' Presence at the right moment drives 3-5x more conversations than passive placement.",
    severity: "high",
  },
  {
    number: "05",
    title: "No monitoring after launch",
    symptom:
      "The bot went live and no one looked at the conversations again. Errors silently accumulate. The bot keeps giving a wrong answer that was never fixed.",
    cause:
      "Chatbot deployment is treated as a one-time project. Once launched, it moves to the 'done' column. But a chatbot's quality degrades without active maintenance.",
    fix: "Review 20 conversations per week for the first month. Look for: questions the bot refused to answer, questions it answered incorrectly, topics that came up repeatedly that aren't in the KB. Each of these is a data point for improving the knowledge base or adjusting the persona. After month one, a bi-weekly review is usually sufficient for stable catalogs.",
    severity: "medium",
  },
  {
    number: "06",
    title: "Measuring the wrong metric",
    symptom:
      "The team reports the bot is 'working' because deflection rate is high. Actual sales from bot-assisted conversations is zero. Leadership eventually questions the ROI.",
    cause:
      "Deflection rate (questions answered without human involvement) is the default metric for support bots. For a sales agent, the right metric is conversation-to-purchase attribution — did customers who chatted buy at a higher rate than those who didn't?",
    fix: "Track: (1) conversations that included a product recommendation followed by a purchase; (2) sessions where buying intent was detected; (3) cart abandonment recovery rate for customers who chatted vs. those who didn't. These metrics take more setup but tell you whether the bot is actually contributing to revenue, not just to cost reduction.",
    severity: "medium",
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high: "bg-amber-50 border-amber-200 text-amber-700",
  medium: "bg-blue-50 border-blue-200 text-blue-700",
};

export default function ArticlePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Header />
      <main className="min-h-screen">
        <article className="py-16 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <nav className="mb-8 text-sm text-text-muted">
              <Link href="/" className="hover:text-brand-500 transition-colors">Home</Link>
              <span className="mx-2">›</span>
              <Link href="/blog" className="hover:text-brand-500 transition-colors">Blog</Link>
              <span className="mx-2">›</span>
              <span className="text-text-secondary">Why Chatbots Fail</span>
            </nav>

            <header className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider bg-brand-50 px-2.5 py-1 rounded-full">
                  Deep dive
                </span>
                <span className="text-xs text-text-muted">8 min read</span>
                <time dateTime="2026-06-03" className="text-xs text-text-muted">
                  · June 3, 2026
                </time>
              </div>
              <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-5 leading-tight">
                Why Chatbots Fail<br />(And What to Do About It)
              </h1>
              <p className="text-xl text-text-secondary leading-relaxed">
                Industry estimates put chatbot deployment failure rates at 60–80% within six months.
                The causes are not mysterious or technical. They are the same six mistakes,
                repeated across every industry. Here is each one — and the exact fix.
              </p>
            </header>

            <div className="prose prose-lg prose-slate max-w-none">
              <p>
                The expectation when a business deploys a chatbot is automation: fewer support
                tickets, more sales, happier customers. The reality, more often than not, is a
                chatbot that gets used for two weeks and then quietly abandoned — customers stop
                trying, and the company stops paying attention.
              </p>
              <p>
                This is not because chatbots are bad technology. It is because deploying a chatbot
                well requires ongoing work that most teams do not plan for. The following six
                failures cover the vast majority of underperforming deployments.
              </p>
            </div>

            <div className="mt-10 space-y-8">
              {FAILURES.map((f) => (
                <section key={f.number} className="card-premium p-7">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-brand-500 text-white font-heading font-extrabold text-sm flex items-center justify-center">
                      {f.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h2 className="font-heading text-xl font-bold text-text-primary">
                          {f.title}
                        </h2>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${SEVERITY_STYLES[f.severity]}`}
                        >
                          {f.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 ml-14">
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                        What you observe
                      </p>
                      <p className="text-text-secondary leading-relaxed">{f.symptom}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                        Root cause
                      </p>
                      <p className="text-text-secondary leading-relaxed">{f.cause}</p>
                    </div>
                    <div className="bg-brand-50 rounded-lg p-4 border border-brand-100">
                      <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
                        The fix
                      </p>
                      <p className="text-text-secondary leading-relaxed text-sm">{f.fix}</p>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="prose prose-lg prose-slate max-w-none mt-12">
              <h2>The common thread</h2>
              <p>
                Most chatbot failures are not caused by bad AI. They are caused by treating a
                chatbot as a finished product rather than a tool that needs ongoing attention.
              </p>
              <p>
                A chatbot that is wrong about your prices is worse than no chatbot — it actively
                damages customer trust. A chatbot with no escalation path is a dead end that
                frustrates customers at exactly the moment they were ready to buy. A chatbot that
                is never monitored after launch keeps making the same mistakes indefinitely.
              </p>
              <p>
                The businesses that see strong ROI from chatbot deployments are the ones that built
                a process around it: weekly KB updates, regular conversation reviews, and metrics
                tied to revenue, not just deflection. That process takes four to six weeks to build.
                After that, the maintenance time drops to one to two hours per week.
              </p>
              <p>
                The first month is always the hardest. It is also where 80% of the value is built.
              </p>

              <h2>If your chatbot is already underperforming</h2>
              <p>
                Run the audit in order. Start with the knowledge base — is it complete and current?
                Check the escalation path — what happens when the bot cannot answer? Review the
                last 50 conversations — which ones ended in abandonment, and why?
              </p>
              <p>
                Most underperforming chatbots can be turned around in two to four weeks with
                focused knowledge base work and a clear escalation rule. The technology is rarely
                the problem. The content and the process almost always are.
              </p>

              <div className="not-prose mt-10 p-6 rounded-xl bg-brand-50 border border-brand-100">
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Start with a clean slate — 14 days free
                </h3>
                <p className="text-text-secondary mb-4">
                  Zudobot&rsquo;s onboarding wizard walks you through the KB setup, persona
                  configuration, and Constitutional Rules before you go live — so you avoid the
                  six failures above from day one.
                </p>
                <Link
                  href="/register"
                  className="inline-block bg-brand-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-brand-600 transition-colors duration-200"
                >
                  Start free trial →
                </Link>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border">
              <Link href="/blog" className="text-brand-500 font-medium hover:underline">
                ← Back to all articles
              </Link>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
