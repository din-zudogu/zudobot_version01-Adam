import { connectDB }        from "@/lib/db/connect";
import { FewShotExampleModel } from "@/lib/db/models/FewShotExample";

const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes
const MAX_EXAMPLES  = 6;

// Static fallback used when DB is empty or unreachable
const STATIC_FALLBACK = [
  { u: "สินค้านี้คืออะไร?",         b: "เป็นระบบ AI ช่วยตอบลูกค้าอัตโนมัติ 24 ชั่วโมงครับ สนใจทดลองใช้ฟรีไหมครับ?" },
  { u: "ราคาเท่าไหร่?",             b: "เริ่มต้น ฿899/เดือนครับ มีแพ็กเกจทดลองฟรี 14 วันด้วยนะครับ" },
  { u: "ใช้งานยากไหม?",             b: "ไม่ยากเลยครับ ติดตั้งได้ใน 5 นาที ไม่ต้องเขียนโค้ดครับ" },
  { u: "มีโปรโมชั่นอะไรบ้าง?",      b: "ตอนนี้มีทดลองฟรี 14 วันอยู่ครับ อยากลองเลยไหมครับ?" },
  { u: "ติดต่อใครได้บ้าง?",         b: "ทักมาได้เลยครับ หรือดูรายละเอียดที่เว็บไซต์ได้เลยนะครับ" },
  { u: "รองรับกี่ภาษา?",            b: "รองรับหลายภาษาเลยครับ ทั้งไทย อังกฤษ จีน และอื่นๆ ครับ" },
];

let _cache: { examples: string; expiresAt: number } | null = null;

function formatExamples(pairs: Array<{ u: string; b: string }>): string {
  return pairs
    .map((p) => `ลูกค้า: ${p.u}\nผู้ช่วย: ${p.b}`)
    .join("\n\n");
}

/**
 * Load few-shot examples — DB first, cached for 5 minutes, fallback to static.
 * Returns a formatted string ready to inject into the system prompt.
 */
export async function loadFewShotExamples(): Promise<string> {
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.examples;

  try {
    await connectDB();
    const docs = await FewShotExampleModel
      .find({ isGlobal: true })
      .sort({ engagementScore: -1 })
      .limit(MAX_EXAMPLES)
      .select("userMessage botResponse")
      .lean();

    if (docs.length === 0) {
      const fallback = formatExamples(STATIC_FALLBACK);
      _cache = { examples: fallback, expiresAt: now + CACHE_TTL_MS };
      return fallback;
    }

    const formatted = formatExamples(
      docs.map((d) => ({ u: d.userMessage, b: d.botResponse })),
    );
    _cache = { examples: formatted, expiresAt: now + CACHE_TTL_MS };
    return formatted;
  } catch {
    // DB unavailable — use static fallback, short cache TTL so it retries soon
    const fallback = formatExamples(STATIC_FALLBACK);
    _cache = { examples: fallback, expiresAt: now + 30_000 };
    return fallback;
  }
}

/** Invalidate the in-memory cache (call after extraction completes). */
export function invalidateFewShotCache(): void {
  _cache = null;
}
