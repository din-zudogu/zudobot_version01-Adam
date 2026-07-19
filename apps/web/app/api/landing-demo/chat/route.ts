import { NextRequest, NextResponse } from "next/server";
import { getChatProvider, type ChatTurn } from "@/lib/ai/providers";
import { enforceRateLimit, clientIp } from "@/lib/security/rateLimit";

/**
 * Public landing-page demo chat. The four demo personas live HERE (server-side)
 * so the Gemini API key never reaches the browser — the landing page used to call
 * Gemini directly with the live key embedded in client JS. Rate-limited and
 * CORS-restricted to the zudogu.com landing origins.
 */
export const dynamic = "force-dynamic";

const STORE_PROMPTS: Record<string, string> = {
  fashion:
    "คุณคือฝ้าย AI Sales Agent ของร้านเสื้อผ้าแฟชันผู้หญิงสไตล์เกาหลี ตอบภาษาไทยเป็นกันเอง สุภาพ กระตุ้นการซื้อด้วยความจริงใจ\n\nสินค้า:\n- เดรสลายดอกคอวี 590฿ (S/M/L/XL)\n- กระโปรง Boho ยาว 490฿ (S/M/L)\n- เสื้อ Crop Top โอเวอร์ไซซ์ 290฿ (S/M/L/XL/2XL)\n- กางเกงขาบานลายสก็อต 650฿ (S/M/L/XL)\n- เซ็ตเสื้อ+กางเกงขาสั้น Linen 790฿ (S/M/L)\n\nส่งทุกวัน 1-3 วันทำการ รับเปลี่ยนไซส์ภายใน 7 วัน\n\nตอบสั้น 2-4 ประโยค ใช้ emoji บ้างเล็กน้อย",
  perfume:
    "คุณคือมล AI Sales Agent ของร้านน้ำหอม ตอบภาษาไทยสุภาพ มีเสน่ห์ แนะนำกลิ่นตามโอกาสและอารมณ์\n\nสินค้า:\n- Floral Bloom EDP 50ml 1,290฿ (ดอกไม้ หวาน อ่อนโยน)\n- Ocean Breeze EDT 100ml 890฿ (ทะเล สดชื่น เหมาะกลางวัน)\n- Rose Noir EDP 30ml 1,590฿ (กุหลาบดำ เซ็กซี่ ออกงานกลางคืน)\n- Vanilla Dream EDC 100ml 790฿ (วานิลลา หวาน น่ารัก)\n- Oud Royal EDP 50ml 2,490฿ (Oud หรู เข้มข้น ทนนาน)\n\nของแท้ 100% ส่งฟรีเมื่อซื้อครบ 1,500฿ มีตัวอย่างกลิ่น 1ml\n\nตอบสั้น 2-4 ประโยค ใช้ emoji บ้าง",
  garden:
    "คุณคือต้น AI Sales Agent ของร้านอุปกรณ์ทำสวน ตอบภาษาไทยเป็นกันเอง แนะนำการปลูกต้นไม้ได้ดี\n\nสินค้า:\n- ชุดเครื่องมือทำสวน 5 ชิ้น 450฿\n- กระถางซีเมนต์ DIY 280฿\n- ดินปลูกผสมพร้อมใช้ 5L 129฿\n- ปุ๋ยอินทรีย์ Premium 1kg 199฿\n- สายยางรดน้ำ 10m + หัวฉีด 390฿\n\nส่งทั่วประเทศ 2-4 วัน มีคำแนะนำปลูกต้นไม้ฟรีทุกออเดอร์\n\nตอบสั้น 2-4 ประโยค ให้ข้อมูลปลูกต้นไม้ที่มีประโยชน์ด้วย",
  zudogu:
    "คุณคือซูโด AI ของ ZUDOGU แพลตฟอร์มอีคอมเมิร์ซสำหรับ SME ไทย ตอบภาษาไทยอย่างมืออาชีพ กระตุ้นให้เห็นคุณค่า\n\nบริการ:\n- Dives Space: เปิดร้านฟรี ไม่มี GP ไม่มีค่าธรรมเนียม\n- ZUDOBOT AI Agent: 999฿/เดือน AI ตอบลูกค้า 24/7\n- Premium: 2,499฿/เดือน ครบทุกฟีเจอร์ + LINE Notify + Analytics\n- Enterprise: ติดต่อสอบถาม Custom Development\n- IT Consulting: ให้คำปรึกษาด้านเทคโนโลยี\n\nติดต่อ: office@zudogu.com\n\nตอบสั้น 2-4 ประโยค เน้นคุณค่าและความแตกต่าง",
};

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
const MAX_HISTORY = 10;

/** Allow only the zudogu.com landing origins (any subdomain) + Amplify defaults. */
function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin") ?? "";
  try {
    const host = new URL(origin).hostname;
    if (host === "zudogu.com" || host.endsWith(".zudogu.com") || host.endsWith(".amplifyapp.com")) {
      return origin;
    }
  } catch {
    /* missing / invalid origin */
  }
  return null;
}

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  origin ?? "https://zudogu.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(allowedOrigin(req)) });
}

export async function POST(req: NextRequest) {
  const headers = cors(allowedOrigin(req));

  // Anti cost-drain: cap demo usage per IP (the demo also has a 20-msg UI cap).
  const rl = await enforceRateLimit(clientIp(req), { prefix: "zudo:landing:rl", max: 30, window: "1 h" });
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  }

  let body: { storeId?: string; history?: { role?: string; text?: string }[]; message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400, headers }); }

  const system = body.storeId ? STORE_PROMPTS[body.storeId] : undefined;
  if (!system) return NextResponse.json({ error: "invalid_store" }, { status: 400, headers });

  const text = (body.message ?? "").trim();
  if (!text || text.length > 500) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400, headers });
  }

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((h): h is { role: "user" | "model"; text: string } =>
          (h?.role === "user" || h?.role === "model") && typeof h?.text === "string")
        .slice(-MAX_HISTORY)
        .map((h) => ({ role: h.role, text: h.text }))
    : [];

  try {
    const result = await getChatProvider().generateChat({
      systemInstruction: system,
      history,
      message:           text,
      modelCandidates:   MODELS,
      temperature:       0.7,
      enableSearch:      false,
      timeoutMs:         20000,
    });
    return NextResponse.json(
      { reply: result.reply || "ขออภัย ตอบไม่ได้ในขณะนี้ ลองใหม่อีกครั้งนะครับ" },
      { headers },
    );
  } catch {
    return NextResponse.json({ reply: "⚠️ AI กำลังยุ่ง ลองใหม่อีกครั้งในสักครู่นะครับ" }, { status: 200, headers });
  }
}
