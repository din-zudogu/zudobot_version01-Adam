import { CoverSplash }               from "@/components/landing/CoverSplash";
import { Header }                    from "@/components/layout/Header";
import { Footer }                    from "@/components/layout/Footer";
import { HeroSection }               from "@/components/landing/HeroSection";
import { SandboxPreviewSection }     from "@/components/landing/SandboxPreviewSection";
import { HowItWorksSection }         from "@/components/landing/HowItWorksSection";
import { FeaturesSection }           from "@/components/landing/FeaturesSection";
import { UseCasesSection }           from "@/components/landing/UseCasesSection";
import { VisionManifestoSection }    from "@/components/landing/VisionManifestoSection";
import { TestimonialsSection }       from "@/components/landing/TestimonialsSection";
import { ReadyPackagePricingSection } from "@/components/landing/ReadyPackagePricingSection";
import { FaqSection }                from "@/components/landing/FaqSection";
import { CtaSection }                from "@/components/landing/CtaSection";
import { BlogPreviewSection }        from "@/components/landing/BlogPreviewSection";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://zudobot.zudogu.com/#organization",
  name: "ZUDOGU",
  url: "https://zudobot.zudogu.com",
  slogan: "Research-driven innovation that lets SMEs stand beside Enterprise.",
  description:
    "ZUDOGU is an innovation creator — not just a marketing competitor. ZUDOBOT is built from deep study of AI, consumer-behaviour, and commerce research, with the mission of giving small businesses and SMEs affordable access to Enterprise-grade AI so they can compete on equal footing.",
  logo: {
    "@type": "ImageObject",
    url: "https://zudobot.zudogu.com/logo.png",
    width: 512,
    height: 512,
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@zudogu.com",
    contactType: "customer support",
    availableLanguage: ["English", "Thai"],
  },
  sameAs: ["https://www.zudogu.com"],
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://zudobot.zudogu.com/#product",
  name: "ZUDOBOT",
  description:
    "AI sales agent that knows your product catalog, serves customers 24/7, detects buying intent, and closes sales automatically. Powered by Gemini 2.0. PDPA & GDPR compliant.",
  url: "https://zudobot.zudogu.com",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Trial",
      price: "0",
      priceCurrency: "THB",
      description: "14-day free trial — 250 messages/day, no credit card required",
    },
    {
      "@type": "Offer",
      name: "Starter",
      price: "990",
      priceCurrency: "THB",
      description: "2,000 messages/month",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "1990",
      priceCurrency: "THB",
      description: "5,000 messages/month",
    },
    {
      "@type": "Offer",
      name: "Master",
      price: "14990",
      priceCurrency: "THB",
      description: "20,000 messages/month",
    },
  ],
  featureList: [
    "Remembers every visitor with UUID tracking",
    "24/7 automated customer responses",
    "Product catalog knowledge base",
    "Buying-intent detection",
    "5-minute one-line install",
    "PDPA and GDPR compliant",
    "Constitutional AI safety rules",
    "LINE notification integration",
    "Multi-language support (English and Thai)",
    "Gemini 2.0 powered",
  ],
  creator: { "@id": "https://zudobot.zudogu.com/#organization" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Zudobot hard to install on my website?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not at all. Copy one JavaScript snippet into your site — no coding skills or IT queue. Most teams finish in under 5 minutes.",
      },
    },
    {
      "@type": "Question",
      name: "How does the bot learn my products?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Upload your knowledge base in the Dashboard — SKUs, prices, promos, FAQs. The bot learns and answers immediately.",
      },
    },
    {
      "@type": "Question",
      name: "What if the bot answers incorrectly?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Constitutional Rules keep replies on-brand. You set forbidden topics and max discount. LINE Notify alerts your team when a human should take over.",
      },
    },
    {
      "@type": "Question",
      name: "Is customer data safe? PDPA / GDPR?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We avoid storing PII; sessions use anonymous UUIDs with configurable retention. Built for PDPA and GDPR expectations.",
      },
    },
    {
      "@type": "Question",
      name: "What happens when quota runs out early?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Email alerts at 80% and 95%. After 100% you get a 5% grace buffer, then a temporary pause message. Upgrade anytime from the Dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "What should I do right after signup?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Follow the 4-step onboarding wizard: name your bot → pick industry → upload catalog (optional) → embed on your site. Under 10 minutes to go live.",
      },
    },
  ],
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://zudobot.zudogu.com/#website",
  url: "https://zudobot.zudogu.com",
  name: "ZUDOBOT",
  description: "AI Sales Agent for global business — Powered by Gemini 2.0",
  publisher: { "@id": "https://zudobot.zudogu.com/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://zudobot.zudogu.com/blog?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://zudobot.zudogu.com/#webpage",
  url: "https://zudobot.zudogu.com",
  name: "ZUDOBOT — AI Sales Agent | ZUDOGU",
  description:
    "AI sales agent for your business — knows your catalog, serves customers 24/7, closes sales automatically. Powered by Gemini 2.0. PDPA & GDPR ready.",
  isPartOf: { "@id": "https://zudobot.zudogu.com/#website" },
  about: { "@id": "https://zudobot.zudogu.com/#product" },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://zudobot.zudogu.com" },
    ],
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />

      <CoverSplash />

      <Header />
      <main>
        <HeroSection />
        <SandboxPreviewSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection />
        <VisionManifestoSection />
        <TestimonialsSection />
        <ReadyPackagePricingSection />
        <FaqSection />
        <CtaSection />
        <BlogPreviewSection />
      </main>
      <Footer />
    </>
  );
}
