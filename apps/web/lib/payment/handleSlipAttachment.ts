import { randomUUID } from "crypto";
import type { GeminiFileAttachment } from "@/lib/ai/geminiWidget";
import { getPaymentMethodConfig, createPaymentTrans } from "@/lib/db/paymentMethods";
import { ensurePaymentMasterData } from "@/lib/db/pg/ensurePaymentMasterData";
import { analyzeSlipImage, decideVerificationOutcome } from "@/lib/payment/slipVerification";
import { uploadSlipImage } from "@/lib/storage/s3";

const PROMPTPAY_HINT_RE = /promptpay|พร้อมเพย์/i;

/**
 * If the customer just attached what looks like a payment slip AND the
 * tenant has a payment method enabled, verify it, persist the image to S3,
 * and log a payment_trans row. Returns a short Thai directive string for
 * runWidgetChat's extraDirective param so the bot's natural-language reply
 * can acknowledge the payment — or null if there's nothing to report (no
 * image, feature disabled, or the image isn't a slip).
 *
 * Never throws — a failure here must not break the normal chat reply.
 */
export async function maybeHandleSlipAttachment(
  tenantId: string,
  sessionId: string,
  attachments: GeminiFileAttachment[]
): Promise<string | null> {
  const imageAttachment = attachments.find(
    (a) => a.mimeType.startsWith("image/") && (a.base64 || a.fileUri)
  );
  if (!imageAttachment) return null;

  try {
    await ensurePaymentMasterData();
    const config = await getPaymentMethodConfig(tenantId);
    if (!config || (!config.promptpayEnabled && !config.bankTransferEnabled)) return null;

    const result = await analyzeSlipImage({
      base64: imageAttachment.base64,
      fileUri: imageAttachment.fileUri,
      mimeType: imageAttachment.mimeType,
    });
    const outcome = decideVerificationOutcome(result);
    if (outcome === "not_a_slip") return null;

    let slipS3Key: string | undefined;
    if (imageAttachment.base64) {
      try {
        slipS3Key = await uploadSlipImage(tenantId, randomUUID(), imageAttachment.base64, imageAttachment.mimeType);
      } catch (err) {
        console.error("[handleSlipAttachment] S3 upload failed:", err);
      }
    }

    const method: "promptpay" | "bank_transfer" = PROMPTPAY_HINT_RE.test(result.bankName ?? "")
      ? "promptpay"
      : "bank_transfer";

    await createPaymentTrans({
      tenantId,
      amountThb: String(result.amountThb ?? 0),
      method,
      sessionId,
      slipS3Key,
      verificationMethod: "gemini_vision",
      confidence: result.confidence,
      extractedBankName: result.bankName,
      extractedRef: result.transactionRef,
      extractedDateTime: result.transactionDateTime,
      status: outcome,
    });

    return outcome === "auto_verified"
      ? `ลูกค้าเพิ่งแนบสลิปการชำระเงิน ระบบตรวจสอบแล้วว่าเป็นสลิปจริงและบันทึกยอดรับชำระ ฿${result.amountThb?.toLocaleString("th-TH")} เรียบร้อยแล้ว — ตอบขอบคุณลูกค้าและยืนยันว่าได้รับเงินแล้ว`
      : `ลูกค้าเพิ่งแนบสลิปการชำระเงิน ระบบบันทึกไว้แล้วแต่ต้องรอร้านค้าตรวจสอบยืนยันอีกครั้ง — ตอบขอบคุณลูกค้าที่แจ้งการชำระเงิน และแจ้งว่าทางร้านจะตรวจสอบและยืนยันให้เร็วที่สุด`;
  } catch (err) {
    console.error("[handleSlipAttachment] failed:", err);
    return null;
  }
}
