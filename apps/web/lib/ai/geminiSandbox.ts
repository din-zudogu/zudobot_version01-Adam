import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SandboxScenario } from "@/components/sandbox/scenarios";

export interface SandboxMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SandboxChatResult {
  reply: string;
  error?: string;
}

const SANDBOX_SAFETY_PREAMBLE = `
คุณเป็น AI Sales Agent ที่สาธิตการทำงานของ Zudobot บนแพลตฟอร์ม Sandbox
กฎเด็ดขาด:
1. ห้ามพูดถึงข้อมูลส่วนตัวของผู้ใช้ (ชื่อ เบอร์ โทร อีเมล) — ถ้าถามให้บอกว่า "กรุณาติดต่อทีมงานโดยตรงค่ะ/ครับ"
2. ห้ามให้ข้อมูลนอกขอบเขตธุรกิจ
3. ตอบภาษาไทยเสมอ เว้นแต่ลูกค้าถามภาษาอังกฤษ
4. ความยาวคำตอบ: กระชับ 1-3 ประโยค เหมาะสำหรับ chat widget
5. นี่คือ Sandbox ประสบการณ์จริง — ตอบอย่างมีชีวิตชีวา เป็นธรรมชาติ
`.trim();

export async function runSandboxChat(
  scenario: SandboxScenario,
  history: SandboxMessage[],
  userMessage: string
): Promise<SandboxChatResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_LIVE;
  if (!apiKey) {
    return { reply: "ขออภัย ระบบ AI ยังไม่พร้อมใช้งานในขณะนี้", error: "GEMINI_API_KEY not configured" };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
      systemInstruction: `${SANDBOX_SAFETY_PREAMBLE}\n\n${scenario.systemPrompt}`,
    });

    const chatHistory = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text().trim();

    return { reply: reply || "ขออภัย ไม่สามารถตอบได้ในขณะนี้" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[geminiSandbox] error:", message);
    return {
      reply: "ขออภัย เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง",
      error: message,
    };
  }
}
