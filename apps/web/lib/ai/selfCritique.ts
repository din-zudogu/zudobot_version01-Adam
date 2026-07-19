import type { GenerativeModel } from "@google/generative-ai";
import { trimToCompleteSentence } from "@/lib/ai/textUtils";

/**
 * Thai text does NOT use spaces between words, so split(/\s+/) is useless.
 * Use character count instead — 180 chars ≈ 2-3 Thai sentences.
 * For mixed Thai/English, character count is still more reliable than word count.
 */
function estimateLength(text: string): number {
  return text.trim().length;
}

// 180 chars ≈ 2-3 sentences in Thai. Override via SELF_CRITIQUE_CHAR_LIMIT env.
const CHAR_THRESHOLD = parseInt(process.env.SELF_CRITIQUE_CHAR_LIMIT ?? "180", 10);

/**
 * 2-pass self-critique: if the response exceeds CHAR_THRESHOLD characters,
 * ask Gemini to shorten it using the same model instance (no extra key needed).
 *
 * Always returns a complete sentence. Never throws — falls back to original.
 */
export async function applySelfCritique(
  reply:  string,
  model:  GenerativeModel,
): Promise<string> {
  if (estimateLength(reply) <= CHAR_THRESHOLD) {
    return trimToCompleteSentence(reply);
  }

  try {
    const result = await model.generateContent(
      `ข้อความนี้ยาวเกินไปสำหรับ chat widget บนมือถือ\n` +
      `ย่อให้เหลือ 1-2 ประโยค เก็บแค่ประเด็นสำคัญที่สุด ห้ามตัดกลางประโยค:\n\n${reply}`,
    );
    const shortened = result.response.text().trim();
    return trimToCompleteSentence(shortened || reply);
  } catch {
    return trimToCompleteSentence(reply);
  }
}
