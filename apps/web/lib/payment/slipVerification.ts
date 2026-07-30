/**
 * Payment-slip verification for the tenant "Payment Methods" feature.
 *
 * Today this is Gemini-vision-only (reads the slip image and reports what it
 * sees) — there is no real Thai bank-verification API wired into this repo.
 * `verificationMethod` is kept as an explicit field throughout (see
 * lib/db/pg/schema.ts's payment_trans table) so a real bank API can be added
 * as a second implementation later without a schema change.
 *
 * The network call (analyzeSlipImage) and the pure decision logic
 * (decideVerificationOutcome / parseSlipAnalysisResponse) are kept separate
 * on purpose — the pure functions are what's unit-tested.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireGeminiApiKey } from "@/lib/env/amplifyGuardrail";

export interface SlipImageInput {
  base64?: string;
  fileUri?: string;
  mimeType: string;
}

export interface SlipAnalysisResult {
  isLikelySlip: boolean;
  amountThb: number | null;
  bankName: string | null;
  transactionRef: string | null;
  transactionDateTime: string | null;
  confidence: number; // 0-1
  suspiciousReasons: string[];
}

export type VerificationOutcome = "auto_verified" | "pending_review" | "not_a_slip";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
const CONFIDENCE_THRESHOLD = parseFloat(
  process.env.SLIP_VERIFICATION_CONFIDENCE_THRESHOLD ?? String(DEFAULT_CONFIDENCE_THRESHOLD)
);

const SAFE_DEFAULT_RESULT: SlipAnalysisResult = {
  isLikelySlip: false,
  amountThb: null,
  bankName: null,
  transactionRef: null,
  transactionDateTime: null,
  confidence: 0,
  suspiciousReasons: ["ai_response_unparseable"],
};

const SLIP_PROMPT = `คุณกำลังตรวจสอบภาพที่ลูกค้าส่งมาในแชทของร้านค้าออนไลน์ ว่าเป็น "สลิปการโอนเงิน/ชำระเงินผ่านแอปธนาคารหรือ PromptPay" หรือไม่

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ตามรูปแบบนี้:
{
  "isLikelySlip": boolean,
  "amountThb": number หรือ null,
  "bankName": string หรือ null,
  "transactionRef": string หรือ null,
  "transactionDateTime": string หรือ null,
  "confidence": number ระหว่าง 0 ถึง 1,
  "suspiciousReasons": string[] (เหตุผลถ้าดูน่าสงสัยว่าอาจถูกตัดต่อ/ปลอม เช่น ฟอนต์ไม่ตรงกัน ตัวเลขซ้อนทับ พื้นหลังผิดปกติ — array ว่างถ้าไม่มี)
}

เกณฑ์: isLikelySlip=true เฉพาะภาพที่มีลักษณะเป็นสลิปธนาคาร/PromptPay จริง (มีโลโก้ธนาคาร จำนวนเงิน วันเวลา เลขอ้างอิง) confidence ต่ำถ้าภาพไม่ชัดหรือมีจุดน่าสงสัย`;

function buildImagePart(input: SlipImageInput) {
  if (input.fileUri) return { fileData: { mimeType: input.mimeType, fileUri: input.fileUri } };
  return { inlineData: { mimeType: input.mimeType, data: input.base64 ?? "" } };
}

/** Leniently parses Gemini's raw text response into a SlipAnalysisResult. Never throws. */
export function parseSlipAnalysisResponse(rawText: string): SlipAnalysisResult {
  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return SAFE_DEFAULT_RESULT;
    const parsed = JSON.parse(match[0]) as Partial<SlipAnalysisResult>;

    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;

    return {
      isLikelySlip: parsed.isLikelySlip === true,
      amountThb: typeof parsed.amountThb === "number" && parsed.amountThb > 0 ? parsed.amountThb : null,
      bankName: typeof parsed.bankName === "string" ? parsed.bankName : null,
      transactionRef: typeof parsed.transactionRef === "string" ? parsed.transactionRef : null,
      transactionDateTime: typeof parsed.transactionDateTime === "string" ? parsed.transactionDateTime : null,
      confidence,
      suspiciousReasons: Array.isArray(parsed.suspiciousReasons)
        ? parsed.suspiciousReasons.filter((r): r is string => typeof r === "string")
        : [],
    };
  } catch {
    return SAFE_DEFAULT_RESULT;
  }
}

/**
 * Pure decision function — never touches the network. Kept separate from
 * analyzeSlipImage() specifically so it can be unit-tested without a live
 * Gemini call.
 */
export function decideVerificationOutcome(
  result: SlipAnalysisResult,
  threshold: number = CONFIDENCE_THRESHOLD
): VerificationOutcome {
  if (!result.isLikelySlip) return "not_a_slip";
  if (result.amountThb == null) return "pending_review";
  if (result.suspiciousReasons.length > 0) return "pending_review";
  return result.confidence >= threshold ? "auto_verified" : "pending_review";
}

/** Calls Gemini vision on the slip image. Never throws — degrades to the safe default result. */
export async function analyzeSlipImage(input: SlipImageInput): Promise<SlipAnalysisResult> {
  try {
    const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_SLIP_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent([
      { text: SLIP_PROMPT },
      buildImagePart(input),
    ]);
    return parseSlipAnalysisResponse(result.response.text());
  } catch (err) {
    console.error("[slipVerification] analyzeSlipImage failed:", err);
    return SAFE_DEFAULT_RESULT;
  }
}
