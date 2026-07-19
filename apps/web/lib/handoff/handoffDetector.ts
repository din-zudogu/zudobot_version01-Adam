/**
 * Handoff Intent Detector — Master Data Table
 *
 * Detects when a customer wants to talk to a real human agent.
 * Detection is INPUT-based (customer's message), not output-based.
 *
 * Categories:
 *   A — ขอ/อยาก/ต้องการ คุยกับ คน/เจ้าหน้าที่/แอดมิน/พนักงาน
 *   B — เรียก/ขอ เจ้าหน้าที่/แอดมิน/พนักงาน/คน
 *   C — โอนสาย/ต่อสาย/ให้คนมา
 *   D — ปฏิเสธบอท/AI
 *   E — ขอให้โทรกลับ/ติดต่อกลับ
 *   F — English keywords
 *   G — Mixed Thai-English
 *   H — Informal / slang
 */

export interface HandoffKeywordEntry {
  keyword:  string;   // normalized (lowercase, no extra spaces)
  category: string;
  label:    string;   // human-readable description
}

export const HANDOFF_KEYWORD_TABLE: readonly HandoffKeywordEntry[] = [

  // ── A: ขอ/อยาก/ต้องการ + คุยกับ + คน/เจ้าหน้าที่/แอดมิน ─────────────

  { keyword: "ขอคุยกับคน",              category: "A", label: "ขอคุยกับคนจริงๆ" },
  { keyword: "คุยกับคน",                category: "A", label: "ขอคุยกับคน (กลาง)" },
  { keyword: "อยากคุยกับคน",            category: "A", label: "อยากคุยกับคน" },
  { keyword: "ต้องการคุยกับคน",          category: "A", label: "ต้องการคุยกับคน" },
  { keyword: "ขอคุยกับคนจริง",           category: "A", label: "ขอคุยกับคนจริงๆ (ย้ำ)" },
  { keyword: "คุยกับคนจริง",             category: "A", label: "คุยกับคนจริงๆ" },
  { keyword: "ขอคุยกับเจ้าหน้าที่",      category: "A", label: "ขอคุยกับเจ้าหน้าที่" },
  { keyword: "คุยกับเจ้าหน้าที่",        category: "A", label: "คุยกับเจ้าหน้าที่ (กลาง)" },
  { keyword: "อยากคุยกับเจ้าหน้าที่",   category: "A", label: "อยากคุยกับเจ้าหน้าที่" },
  { keyword: "ต้องการคุยกับเจ้าหน้าที่", category: "A", label: "ต้องการคุยกับเจ้าหน้าที่" },
  { keyword: "ขอคุยกับแอดมิน",          category: "A", label: "ขอคุยกับแอดมิน" },
  { keyword: "คุยกับแอดมิน",            category: "A", label: "คุยกับแอดมิน (กลาง)" },
  { keyword: "อยากคุยกับแอดมิน",        category: "A", label: "อยากคุยกับแอดมิน" },
  { keyword: "ต้องการคุยกับแอดมิน",     category: "A", label: "ต้องการคุยกับแอดมิน" },
  { keyword: "ขอคุยกับพนักงาน",         category: "A", label: "ขอคุยกับพนักงาน" },
  { keyword: "คุยกับพนักงาน",           category: "A", label: "คุยกับพนักงาน (กลาง)" },
  { keyword: "อยากคุยกับพนักงาน",       category: "A", label: "อยากคุยกับพนักงาน" },
  { keyword: "ต้องการคุยกับพนักงาน",    category: "A", label: "ต้องการคุยกับพนักงาน" },
  { keyword: "ขอคุยกับทีมงาน",          category: "A", label: "ขอคุยกับทีมงาน" },
  { keyword: "คุยกับทีมงาน",            category: "A", label: "คุยกับทีมงาน (กลาง)" },
  { keyword: "ขอคุยกับพี่",             category: "A", label: "ขอคุยกับพี่ (informal)" },
  { keyword: "ขอคุยกับน้อง",            category: "A", label: "ขอคุยกับน้อง (informal)" },
  { keyword: "ขอคุยกับคุณ",             category: "A", label: "ขอคุยกับคุณ (informal)" },
  { keyword: "พูดกับคน",                category: "A", label: "พูดกับคนจริงๆ" },
  { keyword: "สนทนากับเจ้าหน้าที่",     category: "A", label: "สนทนากับเจ้าหน้าที่ (formal)" },
  { keyword: "พูดคุยกับเจ้าหน้าที่",    category: "A", label: "พูดคุยกับเจ้าหน้าที่" },

  // ── B: เรียก/ขอ เจ้าหน้าที่/แอดมิน ────────────────────────────────────

  { keyword: "เรียกเจ้าหน้าที่",         category: "B", label: "เรียกเจ้าหน้าที่" },
  { keyword: "เรียกแอดมิน",              category: "B", label: "เรียกแอดมิน" },
  { keyword: "เรียกคน",                  category: "B", label: "เรียกคนมาช่วย" },
  { keyword: "เรียกพนักงาน",             category: "B", label: "เรียกพนักงาน" },
  { keyword: "ขอเจ้าหน้าที่",            category: "B", label: "ขอเจ้าหน้าที่" },
  { keyword: "ขอแอดมิน",                 category: "B", label: "ขอแอดมิน" },
  { keyword: "ขอพนักงาน",               category: "B", label: "ขอพนักงาน" },
  { keyword: "ให้เจ้าหน้าที่มา",         category: "B", label: "ให้เจ้าหน้าที่มา" },
  { keyword: "ให้แอดมินมา",              category: "B", label: "ให้แอดมินมา" },
  { keyword: "ให้คนมา",                  category: "B", label: "ให้คนมาช่วย" },
  { keyword: "ให้พนักงานมา",             category: "B", label: "ให้พนักงานมา" },
  { keyword: "ขอให้เจ้าหน้าที่",         category: "B", label: "ขอให้เจ้าหน้าที่มาช่วย" },
  { keyword: "ขอให้แอดมิน",              category: "B", label: "ขอให้แอดมินมา" },
  { keyword: "ขอให้คน",                  category: "B", label: "ขอให้คนมา" },
  { keyword: "ต้องการเจ้าหน้าที่",       category: "B", label: "ต้องการเจ้าหน้าที่" },
  { keyword: "ต้องการแอดมิน",            category: "B", label: "ต้องการแอดมิน" },
  { keyword: "ต้องการพนักงาน",           category: "B", label: "ต้องการพนักงาน" },
  { keyword: "ขอความช่วยเหลือจากเจ้าหน้าที่", category: "B", label: "ขอความช่วยเหลือจากเจ้าหน้าที่ (formal)" },
  { keyword: "แอดมินอยู่ไหม",            category: "B", label: "มีแอดมินไหม" },
  { keyword: "แอดมินอยู่มั้ย",           category: "B", label: "มีแอดมินไหม (informal)" },
  { keyword: "มีแอดมินไหม",             category: "B", label: "มีแอดมินไหม (ถาม)" },
  { keyword: "มีคนรับไหม",              category: "B", label: "มีคนรับสายไหม" },
  { keyword: "มีคนอยู่ไหม",             category: "B", label: "มีคนอยู่ไหม" },
  { keyword: "มีเจ้าหน้าที่ไหม",        category: "B", label: "มีเจ้าหน้าที่ไหม" },

  // ── C: โอน/ต่อสาย/ให้คนมาช่วย ─────────────────────────────────────────

  { keyword: "โอนให้คน",                 category: "C", label: "โอนให้คนจริงๆ" },
  { keyword: "โอนให้เจ้าหน้าที่",        category: "C", label: "โอนให้เจ้าหน้าที่" },
  { keyword: "โอนสาย",                   category: "C", label: "โอนสาย" },
  { keyword: "ต่อสาย",                   category: "C", label: "ต่อสายให้เจ้าหน้าที่" },
  { keyword: "ต่อให้คน",                 category: "C", label: "ต่อสายให้คน" },
  { keyword: "ต่อให้เจ้าหน้าที่",        category: "C", label: "ต่อให้เจ้าหน้าที่" },
  { keyword: "เชื่อมต่อเจ้าหน้าที่",     category: "C", label: "เชื่อมต่อเจ้าหน้าที่ (formal)" },
  { keyword: "กรุณาเชื่อมต่อ",           category: "C", label: "กรุณาเชื่อมต่อเจ้าหน้าที่ (polite)" },
  { keyword: "ส่งต่อให้คน",              category: "C", label: "ส่งต่อให้คน" },
  { keyword: "ส่งให้เจ้าหน้าที่",        category: "C", label: "ส่งให้เจ้าหน้าที่" },

  // ── D: ปฏิเสธบอท/AI ────────────────────────────────────────────────────

  { keyword: "ไม่เอาบอท",               category: "D", label: "ไม่ต้องการบอท" },
  { keyword: "ไม่อยากคุยกับบอท",        category: "D", label: "ไม่อยากคุยกับบอท" },
  { keyword: "ไม่ต้องการบอท",           category: "D", label: "ไม่ต้องการบอท (formal)" },
  { keyword: "ไม่คุยกับบอท",            category: "D", label: "ปฏิเสธบอท" },
  { keyword: "บอทช่วยไม่ได้",           category: "D", label: "บอทช่วยไม่ได้" },
  { keyword: "บอทตอบไม่ได้",            category: "D", label: "บอทตอบไม่ได้" },
  { keyword: "ai ช่วยไม่ได้",           category: "D", label: "AI ช่วยไม่ได้" },
  { keyword: "ai ตอบไม่ได้",            category: "D", label: "AI ตอบไม่ได้" },
  { keyword: "ไม่เอา ai",               category: "D", label: "ไม่ต้องการ AI" },
  { keyword: "ไม่คุยกับ ai",            category: "D", label: "ปฏิเสธ AI" },
  { keyword: "เอาคนจริง",               category: "D", label: "ขอคนจริงๆ" },
  { keyword: "ขอคนจริง",                category: "D", label: "ขอคนจริงๆ (ตรง)" },
  { keyword: "คนจริงๆ",                 category: "D", label: "คนจริงๆ" },
  { keyword: "ไม่อยากใช้บอท",           category: "D", label: "ไม่อยากใช้บอท" },
  { keyword: "ไม่ต้องบอท",              category: "D", label: "ไม่ต้องบอท (ตัดสั้น)" },
  { keyword: "บอทโง่",                  category: "D", label: "ลูกค้าหงุดหิด (บอทโง่)" },
  { keyword: "บอทห่วย",                 category: "D", label: "ลูกค้าหงุดหิด (บอทห่วย)" },
  { keyword: "บอทไม่รู้เรื่อง",         category: "D", label: "บอทไม่เข้าใจ" },
  { keyword: "ระบบอัตโนมัติช่วยไม่ได้", category: "D", label: "ระบบอัตโนมัติไม่ได้เรื่อง" },

  // ── E: ขอให้โทรกลับ/ติดต่อกลับ ─────────────────────────────────────────

  { keyword: "ให้โทรกลับ",              category: "E", label: "ขอให้โทรกลับ" },
  { keyword: "ขอให้โทรกลับ",            category: "E", label: "ขอให้โทรกลับ (ตรง)" },
  { keyword: "โทรกลับหน่อย",            category: "E", label: "โทรกลับหน่อย" },
  { keyword: "โทรหาฉัน",               category: "E", label: "โทรหาฉัน" },
  { keyword: "รบกวนโทรกลับ",           category: "E", label: "รบกวนโทรกลับ (polite)" },
  { keyword: "ให้ติดต่อกลับ",           category: "E", label: "ให้ติดต่อกลับ" },
  { keyword: "ขอให้ติดต่อกลับ",         category: "E", label: "ขอให้ติดต่อกลับ (formal)" },
  { keyword: "ติดต่อกลับด้วย",          category: "E", label: "ติดต่อกลับด้วย" },
  { keyword: "ฝากเบอร์ได้ไหม",         category: "E", label: "ฝากเบอร์ได้ไหม" },
  { keyword: "ขอเบอร์ติดต่อ",           category: "E", label: "ขอเบอร์ติดต่อ" },

  // ── F: English ──────────────────────────────────────────────────────────

  { keyword: "talk to human",            category: "F", label: "Talk to human" },
  { keyword: "talk to a human",          category: "F", label: "Talk to a human" },
  { keyword: "talk to real person",      category: "F", label: "Talk to real person" },
  { keyword: "talk to a real person",    category: "F", label: "Talk to a real person" },
  { keyword: "talk to agent",            category: "F", label: "Talk to agent" },
  { keyword: "talk to an agent",         category: "F", label: "Talk to an agent" },
  { keyword: "talk to someone",          category: "F", label: "Talk to someone" },
  { keyword: "speak to human",           category: "F", label: "Speak to human" },
  { keyword: "speak to a human",         category: "F", label: "Speak to a human" },
  { keyword: "speak to agent",           category: "F", label: "Speak to agent" },
  { keyword: "speak to someone",         category: "F", label: "Speak to someone" },
  { keyword: "speak to a real person",   category: "F", label: "Speak to a real person" },
  { keyword: "connect to agent",         category: "F", label: "Connect to agent" },
  { keyword: "connect to human",         category: "F", label: "Connect to human" },
  { keyword: "transfer to agent",        category: "F", label: "Transfer to agent" },
  { keyword: "live agent",               category: "F", label: "Live agent" },
  { keyword: "live person",              category: "F", label: "Live person" },
  { keyword: "live support",             category: "F", label: "Live support" },
  { keyword: "human agent",              category: "F", label: "Human agent" },
  { keyword: "real agent",               category: "F", label: "Real agent" },
  { keyword: "real person",              category: "F", label: "Real person" },
  { keyword: "customer service",         category: "F", label: "Customer service" },
  { keyword: "customer support",         category: "F", label: "Customer support" },
  { keyword: "i need a human",           category: "F", label: "I need a human" },
  { keyword: "i want a human",           category: "F", label: "I want a human" },
  { keyword: "get me a human",           category: "F", label: "Get me a human" },
  { keyword: "no bot",                   category: "F", label: "No bot" },
  { keyword: "not a bot",                category: "F", label: "Not a bot (ต้องการคน)" },
  { keyword: "stop bot",                 category: "F", label: "Stop bot" },
  { keyword: "human please",             category: "F", label: "Human please" },
  { keyword: "agent please",             category: "F", label: "Agent please" },
  { keyword: "representative",           category: "F", label: "Representative" },
  { keyword: "call me back",             category: "F", label: "Call me back" },
  { keyword: "call back",                category: "F", label: "Call back" },

  // ── G: Mixed Thai-English ────────────────────────────────────────────────

  { keyword: "ขอ human",                 category: "G", label: "ขอ human" },
  { keyword: "ขอ agent",                 category: "G", label: "ขอ agent" },
  { keyword: "ต้องการ agent",            category: "G", label: "ต้องการ agent" },
  { keyword: "ต้องการ human",            category: "G", label: "ต้องการ human" },
  { keyword: "คุยกับ human",             category: "G", label: "คุยกับ human" },
  { keyword: "คุยกับ agent",             category: "G", label: "คุยกับ agent" },
  { keyword: "ขอ live chat",             category: "G", label: "ขอ live chat" },
  { keyword: "live chat ได้ไหม",         category: "G", label: "Live chat ได้ไหม" },
  { keyword: "human agent ได้ไหม",       category: "G", label: "Human agent ได้ไหม" },
  { keyword: "admin อยู่ไหม",           category: "G", label: "Admin อยู่ไหม" },
  { keyword: "admin มั้ย",              category: "G", label: "Admin มั้ย" },

  // ── H: Informal / Slang ──────────────────────────────────────────────────

  { keyword: "ขอคุยกับคนหน่อย",          category: "H", label: "ขอคุยกับคนหน่อย (informal)" },
  { keyword: "ขอคุยกับคนได้ไหม",         category: "H", label: "ขอคุยกับคนได้ไหม" },
  { keyword: "ขอคุยกับคนจริงๆหน่อย",     category: "H", label: "ขอคุยกับคนจริงๆ หน่อย" },
  { keyword: "ให้คนจริงมาคุย",           category: "H", label: "ให้คนจริงมาคุย" },
  { keyword: "ให้คนจริงตอบ",             category: "H", label: "ให้คนจริงตอบ" },
  { keyword: "เอาคนมาคุย",               category: "H", label: "เอาคนมาคุย" },
  { keyword: "อยากคุยกับคนจริงๆ",        category: "H", label: "อยากคุยกับคนจริงๆ" },
  { keyword: "เอาคนมาตอบ",               category: "H", label: "เอาคนมาตอบ" },
  { keyword: "ให้คนตอบ",                 category: "H", label: "ให้คนตอบ" },
  { keyword: "ให้คนมาตอบ",               category: "H", label: "ให้คนมาตอบ" },
  { keyword: "เรียกคนมาด้วย",            category: "H", label: "เรียกคนมาด้วย" },
  { keyword: "ช่วยให้คนมาคุย",           category: "H", label: "ช่วยให้คนมาคุย" },
  { keyword: "ขอคุยกับคนงาน",           category: "H", label: "ขอคุยกับคนงาน" },
  { keyword: "ขอคุยกับเจ้าของ",          category: "H", label: "ขอคุยกับเจ้าของร้าน" },
  { keyword: "คุยกับเจ้าของ",            category: "H", label: "คุยกับเจ้าของร้าน" },
  { keyword: "ขอคุยกับหัวหน้า",          category: "H", label: "ขอคุยกับหัวหน้า" },
  { keyword: "ขอคุยกับคนดูแล",          category: "H", label: "ขอคุยกับคนดูแล" },
  { keyword: "ให้คนดูแลมา",             category: "H", label: "ให้คนดูแลมา" },
];

// ── Detection function ──────────────────────────────────────────────────────

/**
 * Normalize a message for comparison:
 * - Lowercase
 * - Collapse whitespace
 * - Remove Thai/Latin punctuation that doesn't affect meaning
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if the customer's message indicates they want to talk to a human.
 * Also returns the matched keyword entry for logging/analytics.
 */
export function detectHandoffIntent(message: string): {
  isHandoff: boolean;
  matchedKeyword: HandoffKeywordEntry | null;
} {
  const normalizedMsg = normalize(message);
  // Also check a space-free version to handle Thai spacing inconsistency
  const spaceFreeMsg  = normalizedMsg.replace(/\s/g, "");

  for (const entry of HANDOFF_KEYWORD_TABLE) {
    const kw          = normalize(entry.keyword);
    const kwSpaceFree = kw.replace(/\s/g, "");

    if (normalizedMsg.includes(kw) || spaceFreeMsg.includes(kwSpaceFree)) {
      return { isHandoff: true, matchedKeyword: entry };
    }
  }

  return { isHandoff: false, matchedKeyword: null };
}

/** Flat array of just the keywords — for reference or simple checks */
export const HANDOFF_KEYWORDS = HANDOFF_KEYWORD_TABLE.map((e) => e.keyword);
