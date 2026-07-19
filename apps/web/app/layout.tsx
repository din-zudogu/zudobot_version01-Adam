import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { PlatformGlobalSiteWidgetLoader } from "@/components/widget/PlatformGlobalSiteWidgetLoader";

export const metadata: Metadata = {
  title: {
    default: "ZUDOBOT — AI Sales Agent | ZUDOGU",
    template: "%s | ZUDOBOT",
  },
  description:
    "AI sales agent for your business — knows your catalog, serves customers 24/7, closes sales automatically. Powered by Gemini 2.0. PDPA & GDPR ready. By ZUDOGU.",
  keywords: [
    "AI sales agent", "chatbot", "zudobot", "zudogu", "multilingual chatbot",
    "AI customer service", "e-commerce chatbot", "sales automation", "LINE chatbot",
    "PDPA compliant chatbot", "Gemini AI chatbot", "Thailand AI sales bot",
  ],
  metadataBase: new URL("https://zudobot.zudogu.com"),
  alternates: { canonical: "https://zudobot.zudogu.com" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "ZUDOBOT — AI Sales Agent | ZUDOGU",
    description:
      "AI sales agent — knows your products, serves customers 24/7, closes sales for real. Powered by Gemini 2.0.",
    url: "https://zudobot.zudogu.com",
    siteName: "ZUDOBOT",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://zudobot.zudogu.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZUDOBOT — AI Sales Agent powered by Gemini 2.0",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZUDOBOT — AI Sales Agent",
    description: "AI sales agent for your business — knows your catalog, serves customers 24/7, closes sales.",
    images: ["https://zudobot.zudogu.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased bg-surface text-text-primary">
        <AppProviders>{children}</AppProviders>
        {/* Official Zudobot sales/support widget (System B — the GLOBAL platform bot).
            Persona: /admin/zudobot-config · domain whitelist: /admin/zudobot ·
            knowledge: global chat tenant. Renders site-wide except /admin. */}
        <PlatformGlobalSiteWidgetLoader />
      </body>
    </html>
  );
}
