import * as cheerio from "cheerio";

const TIMEOUT_MS    = 10_000;
const MAX_CHARS     = 50_000;
const CHUNK_SIZE    = 500;
const CHUNK_OVERLAP = 80;
const MIN_CHUNK_LEN = 80;
const JINA_THRESHOLD = 300; // chars — below this, try Jina fallback

// Platforms that require login to access content
const LOGIN_REQUIRED_HOSTS = [
  "facebook.com", "fb.com", "m.facebook.com",
  "instagram.com",
  "twitter.com", "x.com",
  "linkedin.com",
  "tiktok.com",
  "line.me", "liff.line.me",
  "mail.google.com", "docs.google.com", "drive.google.com",
  "dropbox.com", "notion.so",
  "app.hubspot.com", "salesforce.com",
];

export type ScrapeBlockReason = "login_required";

export interface ScrapeBlockedError extends Error {
  reason: ScrapeBlockReason;
  hostname: string;
}

/** Returns true + throws ScrapeBlockedError if the URL requires login. */
export function checkLoginRequired(url: string): void {
  try {
    const { hostname } = new URL(url);
    const clean = hostname.replace(/^www\./, "").toLowerCase();
    const blocked = LOGIN_REQUIRED_HOSTS.some(
      (h) => clean === h || clean.endsWith(`.${h}`),
    );
    if (blocked) {
      const err = new Error(`login_required:${clean}`) as ScrapeBlockedError;
      err.reason   = "login_required";
      err.hostname = clean;
      throw err;
    }
  } catch (e) {
    if ((e as ScrapeBlockedError).reason === "login_required") throw e;
    // URL parse error — let the caller handle
  }
}

export async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        "User-Agent": "Zudobot/1.0 (+https://zudobot.zudogu.com)",
        // Request rendered HTML — works with Next.js SSR pages
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

    const html = await res.text();
    const $    = cheerio.load(html);

    // Remove only non-content elements — keep main, article, section, div
    // so product cards and data sections are preserved
    $("script, style, iframe, noscript, [aria-hidden='true']").remove();
    $("svg, img, picture, video, audio, canvas").remove();

    const title       = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const ogTitle     = $('meta[property="og:title"]').attr("content")?.trim() ?? "";

    // Extract structured content: headings + paragraphs + list items + links text
    const structured: string[] = [];
    if (title)       structured.push(`หัวเรื่อง: ${title}`);
    if (ogTitle && ogTitle !== title) structured.push(`ชื่อหน้า: ${ogTitle}`);
    if (description) structured.push(`คำอธิบาย: ${description}`);

    // Headings — high-value for product names
    $("h1, h2, h3, h4").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length > 2) structured.push(t);
    });

    // Body text
    const body = $("body").text().replace(/\s+/g, " ").trim();
    const combined = structured.join("\n") + "\n\n" + body;

    const result = combined.slice(0, MAX_CHARS);

    // Tier 2 fallback: if Cheerio got sparse content, try Jina AI Reader
    // which executes JavaScript and returns clean readable text
    if (result.trim().length < JINA_THRESHOLD) {
      const jinaText = await scrapeViaJina(url);
      if (jinaText && jinaText.length > result.trim().length) return jinaText;
    }

    return result;
  } finally {
    clearTimeout(timer);
  }
}

/** Jina AI Reader — renders JavaScript, returns clean markdown text (free tier). */
async function scrapeViaJina(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal:  controller.signal,
      headers: {
        "User-Agent": "Zudobot/1.0",
        "Accept":     "text/plain",
        "X-Return-Format": "text",
      },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, MAX_CHARS);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const chunk = text.slice(start, start + CHUNK_SIZE).trim();
    if (chunk.length >= MIN_CHUNK_LEN) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}
