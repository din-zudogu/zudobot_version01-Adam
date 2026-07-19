/** Sentence-ending patterns for Thai + common punctuation. */
const SENTENCE_ENDS = [
  "นะครับ", "นะคะ", "เลยครับ", "เลยคะ",
  "ครับ", "ค่ะ", "คะ",
  "ไหมครับ", "ไหมคะ",
  "?", "!", ".", "…",
];

/**
 * Trim response to the last COMPLETE sentence.
 * Prevents Gemini from delivering a response that ends mid-word due to
 * any upstream token limit or stream truncation.
 *
 * Returns the original string if it already ends on a sentence boundary
 * or no boundary is found (better to keep partial than return empty).
 */
export function trimToCompleteSentence(text: string): string {
  if (!text) return text;
  const trimmed = text.trimEnd();

  // Already ends on a boundary — nothing to do
  if (SENTENCE_ENDS.some((e) => trimmed.endsWith(e))) return trimmed;

  // Find the last sentence boundary in the text
  let lastBoundaryEnd = -1;
  for (const end of SENTENCE_ENDS) {
    const idx = trimmed.lastIndexOf(end);
    if (idx >= 0) {
      const endPos = idx + end.length;
      if (endPos > lastBoundaryEnd) lastBoundaryEnd = endPos;
    }
  }

  // If we found a boundary and there's trailing incomplete text after it
  if (lastBoundaryEnd > 0 && lastBoundaryEnd < trimmed.length) {
    return trimmed.slice(0, lastBoundaryEnd).trim();
  }

  // No boundary found at all — return as-is (incomplete is better than empty)
  return trimmed;
}
