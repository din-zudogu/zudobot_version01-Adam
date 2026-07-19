/**
 * @file unrecordPii.ts
 * @description [IMPACT ANALYSIS GUARDRAILS - APPROVED]
 * ระบบ AI คัดกรองข้อมูลส่วนบุคคล (PII) อ้างอิงตามกฎหมาย PDPA ของไทย และ GDPR ของยุโรป
 * ก่อนที่จะนำข้อความลงบันทึกในฐานข้อมูล MongoDB
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_LIVE || "";
}

export async function unrecord_pii(originalMessage: string): Promise<string> {
  if (!originalMessage || originalMessage.trim() === "") {
    return originalMessage;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return applyRegexFallback(originalMessage);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Default to flash-lite: PII masking doesn't need top-tier quality, and
    // gemini-2.5-flash has been returning 503 "high demand" — flash-lite uses a
    // separate capacity pool, cutting both failures and the per-message latency
    // this adds (it runs on every stored message). Falls back to regex on error.
    const model = genAI.getGenerativeModel(
      { model: process.env.GEMINI_PII_MODEL || "gemini-2.5-flash-lite" },
      { timeout: 8_000 },
    );

    const prompt = `
      คุณคือผู้เชี่ยวชาญด้านกฎหมายความปลอดภัยข้อมูลสารสนเทศไทย (PDPA) และยุโรป (GDPR)
      หน้าที่ของคุณคือรับข้อความของผู้ใช้งานมาตรวจสอบ หากพบข้อมูลชิ้นใดที่ระบุตัวตนของมนุษย์ได้ (PII Data)
      เช่น ชื่อ-นามสกุล, เบอร์โทรศัพท์, เลขบัตรประชาชน, เลขหนังสือเดินทาง, ที่อยู่บ้าน, อีเมล, เลขบัญชีธนาคาร หรือเลขบัตรเครดิต
      ให้คุณทำการเซนเซอร์แทนที่คำเหล่านั้นด้วยคำว่า "[REDACTED PII]" โดยห้ามเปลี่ยนแปลงบริบทหรือข้อความแวดล้อมอื่นๆ ที่ไม่ใช่ข้อมูลส่วนบุคคลเด็ดขาด
      แต่หากข้อความนั้นไม่มีข้อมูล PII อยู่เลย ให้ส่งข้อความเดิมกลับมาทั้งหมด ห้ามเสริมคำพูดทักทาย ห้ามตอบคำถามในแชทเด็ดขาด

      ข้อความที่ต้องตรวจสอบ: "${originalMessage.replace(/"/g, '\\"')}"
    `;

    const response = await model.generateContent(prompt);
    const sanitizedMessage = response.response.text()?.trim();

    return sanitizedMessage || originalMessage;
  } catch (error) {
    console.error(
      "[PII AI Filter Error]: ตรวจพบปัญหาการเชื่อมต่อ Gemini AI, เปิดใช้งานระบบสำรอง Regex",
      error,
    );
    return applyRegexFallback(originalMessage);
  }
}

function applyRegexFallback(originalMessage: string): string {
  let fallbackText = originalMessage;
  const phoneRegex = /(\+?66|0)[689]\d{8}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const citizenIdRegex = /\b\d{1}\s?\d{4}\s?\d{5}\s?\d{2}\s?\d{1}\b/g;

  fallbackText = fallbackText.replace(phoneRegex, "[REDACTED PHONE]");
  fallbackText = fallbackText.replace(emailRegex, "[REDACTED EMAIL]");
  fallbackText = fallbackText.replace(citizenIdRegex, "[REDACTED NATIONAL_ID]");

  return fallbackText;
}
