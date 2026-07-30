/**
 * PromptPay QR generation — pure offline EMV QR payload (no external API,
 * no per-generation cost). `promptpay-qr` builds the EMV payload string,
 * `qrcode` renders it to a PNG data URL for direct <img src> embedding.
 */
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/** Strips spaces/dashes so "081-234-5678" and "0812345678" validate the same. */
export function normalizePromptPayId(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Thai mobile number (10 digits, starts with 0) or citizen/tax ID (13 digits). */
export function isValidPromptPayId(raw: string): boolean {
  const id = normalizePromptPayId(raw);
  if (/^0\d{9}$/.test(id)) return true;
  if (/^\d{13}$/.test(id)) return true;
  return false;
}

export async function generatePromptPayQrDataUrl(promptpayId: string, amountThb?: number): Promise<string> {
  const id = normalizePromptPayId(promptpayId);
  if (!isValidPromptPayId(id)) {
    throw new Error("invalid_promptpay_id");
  }
  const payload = generatePayload(id, amountThb ? { amount: amountThb } : {});
  return QRCode.toDataURL(payload, { width: 320, margin: 1 });
}
