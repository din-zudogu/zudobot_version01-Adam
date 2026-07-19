import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZUDOBOT KMS — Knowledge Management",
  description: "Admin dashboard for managing ZUDOBOT knowledge base and bot configuration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
