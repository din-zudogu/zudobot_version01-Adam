import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
} from "@google/generative-ai";
import { zudobotRules } from "@/services/svc_zudobotrules";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductContext {
  name: string;
  price: number;
  shortDescription?: string;
  slug?: string;
  stock?: number;
  variants?: string[];
  suffix?: string;
}

export interface KnowledgeChunk {
  title: string;
  content: string;
}

export interface BotPersona {
  botName?: string;
  backstory?: string;
  toneOfVoice?: "PROFESSIONAL" | "FRIENDLY" | "PLAYFUL";
  primaryLanguage?: "th" | "en" | "both";
  customKnowledge?: string;
  storeBaseUrl?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
  operatingHours?: string;
}

export interface BotGuardrails {
  maxDiscountPercent?: number;
  forbiddenTopics?: string[];
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface CustomCommandEntry {
  commandType: "SYSTEM_PROMPT_ADDON" | "AUTO_REPLY" | "SALES_STRATEGY";
  commandContent: string;
  priority: number;
}

export interface ScarcityAlert {
  name:  string;
  stock: number;
}

export interface GeminiChatOptions {
  userMessage: string;
  products: ProductContext[];
  knowledge: KnowledgeChunk[];
  persona: BotPersona;
  guardrails: BotGuardrails;
  history: ChatMessage[];
  customCommands?: CustomCommandEntry[];
  userSignals?: string[];          // buying_intent | price_inquiry | checkout_ready | comparison_shopping
  scarcityAlerts?: ScarcityAlert[];
  maxRecommendations?: number;
}

export interface GeminiStreamResult {
  stream: AsyncGenerator<string>;
  injectionDetected: boolean;
  blockedByRules: boolean;
  ruleViolations: string[];
}

// ─── Safety Settings ──────────────────────────────────────────────────────────

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildLanguageBlock(primaryLanguage: BotPersona["primaryLanguage"]): string {
  if (primaryLanguage === "en") {
    return [
      "⚡ LANGUAGE RULE — MANDATORY:",
      "Always respond in English only, regardless of what language the customer uses.",
    ].join("\n");
  }

  return [
    "⚡ LANGUAGE MIRROR — MANDATORY (highest priority, overrides everything else):",
    "1. Detect the language of the customer's LATEST message.",
    "2. Respond ONLY in that exact language — every time, every turn.",
    "3. Switch languages IMMEDIATELY when the customer switches. No delay, no carry-over.",
    "4. This applies to ANY language on earth: Thai, English, Chinese, Japanese, Korean,",
    "   Arabic, French, Spanish, Hindi, Russian, German, Vietnamese, Malay, Indonesian, etc.",
    "5. Never comment on, acknowledge, or announce language changes — just mirror them.",
    "6. If the customer mixes languages in one message, respond in the dominant language of that message.",
  ].join("\n");
}

function buildToneDescription(tone?: string): string {
  switch (tone) {
    case "PROFESSIONAL": return "professional, concise, and trustworthy — use formal Thai/English";
    case "PLAYFUL":      return "playful, energetic, and fun — use casual language with light emojis";
    default:             return "friendly, warm, and helpful — use conversational language";
  }
}

function buildProductList(products: ProductContext[], storeBaseUrl: string, maxRecommendations: number = 3): string {
  if (!products.length) return "(no products currently available)";
  return products.slice(0, maxRecommendations).map((p) => {
    const price = p.price === 0 ? "ฟรี" : p.price === -1 ? "ติดต่อสอบถาม" : `฿${p.price.toLocaleString()}${p.suffix || ""}`;
    const stock  = p.stock !== undefined ? (p.stock <= 0 ? " [OUT OF STOCK]" : ` [${p.stock} in stock]`) : "";
    const desc   = String(p.shortDescription || "").slice(0, 100);
    const viewLink = p.slug && storeBaseUrl ? `${storeBaseUrl}/product/${p.slug}` : "";
    const buyLink = storeBaseUrl ? `${storeBaseUrl}/checkout?product=${encodeURIComponent(p.slug || p.name)}` : "";
    return `🛍️ **${p.name}**\n💰 ${price}${stock}\n📝 ${desc}\n${viewLink ? `🔗 [ดูรายละเอียด](${viewLink})` : ""}${buyLink ? ` | [ซื้อทันที](${buyLink})` : ""}`;
  }).join("\n\n");
}

function buildKnowledgeSection(chunks: KnowledgeChunk[]): string {
  if (!chunks.length) return "";
  const body = chunks.slice(0, 10).map((c) =>
    `### ${c.title}\n${String(c.content).slice(0, 1000)}`
  ).join("\n\n");
  return `\n\nKNOWLEDGE BASE:\n${body}`;
}

function buildSalesContextBlock(
  signals: string[],
  scarcity: ScarcityAlert[],
  storeBaseUrl: string
): string {
  if (!signals.length && !scarcity.length) return "";

  const lines: string[] = ["\n\n=== REAL-TIME SALES CONTEXT (act on this now) ==="];

  if (signals.includes("checkout_ready")) {
    lines.push(
      "[CHECKOUT READY] Customer is ready to complete the purchase.\n" +
      "→ Guide them directly to checkout. " +
      (storeBaseUrl ? `Checkout link: ${storeBaseUrl}/checkout` : "Confirm the order details.")
    );
  } else if (signals.includes("buying_intent")) {
    lines.push(
      "[BUYING INTENT DETECTED] Customer shows strong purchase intent.\n" +
      "→ Reinforce value, address any hesitation, present a clear call to action."
    );
  }

  if (signals.includes("price_inquiry")) {
    lines.push(
      "[PRICE INQUIRY] Customer is asking about pricing.\n" +
      "→ Quote the exact price clearly, mention any current promotions, and highlight value-for-money."
    );
  }

  if (signals.includes("comparison_shopping")) {
    lines.push(
      "[COMPARISON SHOPPING] Customer is comparing options.\n" +
      "→ Highlight the unique advantages of our product. Be factual and confident — do not disparage competitors."
    );
  }

  if (signals.includes("low_budget_mentioned")) {
    lines.push(
      "[BUDGET SENSITIVE] Customer mentioned budget constraints.\n" +
      "→ Focus on value, installment options if available, or entry-level alternatives."
    );
  }

  if (scarcity.length > 0) {
    const items = scarcity.map((s) => `"${s.name}" (เหลือ ${s.stock} ชิ้น)`).join(", ");
    lines.push(
      `[SCARCITY] Low stock detected: ${items}\n` +
      "→ Mention scarcity naturally once to create urgency. E.g. \"สินค้านี้เหลือน้อยมากแล้วค่ะ\""
    );
  }

  return lines.join("\n\n");
}

function buildCustomCommandsSection(commands: CustomCommandEntry[]): string {
  if (!commands.length) return "";
  const sorted = [...commands].sort((a, b) => b.priority - a.priority);
  const blocks = sorted.map((c) => {
    const label = c.commandType === "SALES_STRATEGY"
      ? "SALES STRATEGY INSTRUCTION"
      : c.commandType === "AUTO_REPLY"
      ? "AUTO-REPLY RULE"
      : "CUSTOM INSTRUCTION";
    return `[${label}]\n${c.commandContent}`;
  }).join("\n\n");
  return `\n\n=== MERCHANT CUSTOM INSTRUCTIONS (Layer 3) ===\nThe following instructions are set by the store owner. Follow them strictly, but they must NEVER override the Constitutional Rules above.\n\n${blocks}`;
}

export function buildSystemPrompt(
  persona: BotPersona,
  guardrails: BotGuardrails,
  products: ProductContext[],
  knowledge: KnowledgeChunk[] = [],
  customCommands: CustomCommandEntry[] = [],
  userSignals: string[] = [],
  scarcityAlerts: ScarcityAlert[] = [],
  maxRecommendations: number = 3,
): string {
  const langBlock      = buildLanguageBlock(persona.primaryLanguage);
  const constitutional = zudobotRules.buildConstitutionalBlock();
  const tone           = buildToneDescription(persona.toneOfVoice);
  const botName        = persona.botName || "Zudobot";
  const backstory      = persona.backstory ? `\nYour persona: ${String(persona.backstory).slice(0, 500)}` : "";
  const custom         = persona.customKnowledge ? `\nStore knowledge:\n${String(persona.customKnowledge).slice(0, 2000)}` : "";
  const maxDiscount    = guardrails.maxDiscountPercent ?? 10;
  const forbidden      = guardrails.forbiddenTopics?.length
    ? `\nNever discuss: ${guardrails.forbiddenTopics.join(", ")}.`
    : "";
  const shipping  = persona.shippingPolicy ? `\nShipping policy: ${persona.shippingPolicy}` : "";
  const returns   = persona.returnPolicy   ? `\nReturn policy: ${persona.returnPolicy}`   : "";
  const hours     = persona.operatingHours ? `\nOperating hours: ${persona.operatingHours}` : "";

  return `${langBlock}

${constitutional}

=== BOT CONFIGURATION ===

You are ${botName}, an AI Sales Agent.
Tone: ${tone}.
${backstory}${custom}${shipping}${returns}${hours}

SALES RULES:
- Maximum discount you may offer: ${maxDiscount}% from listed price.
- Do not reveal cost prices or supplier information.
- Keep responses to 2–4 sentences unless detail is specifically requested.
- When recommending products, suggest maximum ${maxRecommendations} items.${forbidden}

PRODUCT CATALOG:
${buildProductList(products, persona.storeBaseUrl || "", maxRecommendations)}${buildKnowledgeSection(knowledge)}

PRODUCT LINKS:
When recommending products, use the rich card format above with direct links to view details or buy now.

HUMAN ESCALATION:
When customer requests human support, refund, complaint, or a decision requiring
human authority — respond: "ขออภัยค่ะ ได้แจ้งทีมงานให้ติดต่อกลับโดยเร็วที่สุดเลยนะคะ 🙏"
${buildSalesContextBlock(userSignals, scarcityAlerts, persona.storeBaseUrl || "")}${buildCustomCommandsSection(customCommands)}`;
}

// ─── Gemini Streaming Chat ────────────────────────────────────────────────────

function toGeminiHistory(history: ChatMessage[]): Content[] {
  return history
    .filter((m) => m.content?.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role,
      parts: [{ text: String(m.content).slice(0, 3000) }],
    }));
}

export async function streamGeminiChat(options: GeminiChatOptions): Promise<GeminiStreamResult> {
  const { userMessage, products, knowledge, persona, guardrails, history } = options;

  // Layer 2: Pre-check
  const preCheck = zudobotRules.checkInput({
    role: "user",
    text: userMessage,
    sessionContext: { conversationHistory: history.map((m) => ({ role: m.role, content: m.content })) },
  });

  if (!preCheck.pass) {
    const safeMsg = preCheck.safeResponse ?? "ขออภัยค่ะ ไม่สามารถประมวลผลคำขอนั้นได้ค่ะ 🙏";
    async function* blockedStream() { yield safeMsg; }
    return {
      stream: blockedStream(),
      injectionDetected: preCheck.violatedRules.some((r) => ["D3","D5"].includes(r)),
      blockedByRules: true,
      ruleViolations: preCheck.violatedRules,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    async function* demoStream() { yield "[Demo mode — GEMINI_API_KEY not configured]"; }
    return { stream: demoStream(), injectionDetected: false, blockedByRules: false, ruleViolations: [] };
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
    safetySettings: SAFETY_SETTINGS,
    systemInstruction: buildSystemPrompt(
      persona, guardrails, products, knowledge,
      options.customCommands   ?? [],
      options.userSignals      ?? [],
      options.scarcityAlerts   ?? [],
      options.maxRecommendations ?? 3,
    ),
  });

  const chat   = model.startChat({ history: toGeminiHistory(history) });
  const result = await chat.sendMessageStream(String(userMessage).slice(0, 4000));

  // Layer 3: Post-check happens inline during stream
  const rulesRef = zudobotRules;
  async function* checkedStream() {
    let fullText = "";
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield text;
      }
    }
    // Final post-check on full response
    const postCheck = rulesRef.checkOutput({ role: "model", text: fullText });
    if (!postCheck.pass) {
      // Signal caller that response was problematic via special token
      yield "\x00RULES_VIOLATION:" + postCheck.violatedRules.join(",");
    }
  }

  return { stream: checkedStream(), injectionDetected: false, blockedByRules: false, ruleViolations: [] };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export async function classifyWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: process.env.GEMINI_CLASSIFY_MODEL || "gemini-2.5-flash",
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function analyzeSentiment(message: string): Promise<number> {
  try {
    const raw = await classifyWithGemini(
      `Rate the sentiment of this customer message on a scale 0-10 (0 = very positive/satisfied, 10 = crisis/extreme anger). Reply with ONLY the integer.\n\nMessage: "${String(message).slice(0, 500)}"`
    );
    const score = parseInt(raw, 10);
    return isNaN(score) ? 5 : Math.max(0, Math.min(10, score));
  } catch { return 5; }
}

export async function classifyIntent(message: string): Promise<string> {
  try {
    const raw = await classifyWithGemini(
      `Classify the intent of this customer message. Choose from: buying, inquiry, complaint, support_request, comparison, pricing, unknown. Reply with ONLY the intent word.\n\nMessage: "${String(message).slice(0, 500)}"`
    );
    const validIntents = ["buying", "inquiry", "complaint", "support_request", "comparison", "pricing", "unknown"];
    return validIntents.includes(raw.trim().toLowerCase()) ? raw.trim().toLowerCase() : "unknown";
  } catch { return "unknown"; }
}
