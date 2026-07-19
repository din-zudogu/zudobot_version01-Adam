import type { BotConfig, RecommendedProduct, FileAttachment } from "./types";
import { parseWidgetJsonResponse } from "./parseWidgetJson";

export async function initWidget(
  embedKey: string,
  apiUrl:   string,
): Promise<BotConfig | null> {
  try {
    const res = await fetch(`${apiUrl}/api/widget/init`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: embedKey }),
    });
    if (!res.ok) return null;
    const data = await parseWidgetJsonResponse<{ ok: boolean; config?: BotConfig }>(res);
    return data?.ok && data.config ? data.config : null;
  } catch {
    return null;
  }
}

export async function uploadFile(
  file:     File,
  embedKey: string,
  apiUrl:   string,
): Promise<FileAttachment | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("key", embedKey);
    const res = await fetch(`${apiUrl}/api/widget/upload`, { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; attachment?: FileAttachment };
    return data?.ok && data.attachment ? data.attachment : null;
  } catch {
    return null;
  }
}

export async function sendChatMessage(
  embedKey:     string,
  apiUrl:       string,
  sessionId:    string,
  message:      string,
  consentGiven?: boolean,
  attachments?:  FileAttachment[],
  visitorId?:    string,
): Promise<{ reply: string; blocked?: boolean; handoffMode?: boolean; products?: RecommendedProduct[]; consentRequired?: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/api/widget/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: embedKey, sessionId, message, consentGiven, attachments, visitorId }),
    });
    const data = await parseWidgetJsonResponse<{
      ok: boolean;
      reply?: string;
      blocked?: boolean;
      handoffMode?: boolean;
      products?: RecommendedProduct[];
      consentRequired?: boolean;
    }>(res);
    if (!res.ok || !data) {
      return { reply: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ 🙏" };
    }
    return {
      reply:           data.reply ?? "ขออภัย ไม่สามารถตอบได้ในขณะนี้",
      blocked:         data.blocked,
      handoffMode:     data.handoffMode,
      products:        data.products,
      consentRequired: data.consentRequired,
    };
  } catch {
    return { reply: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ 🙏" };
  }
}

export type LegalDocType = "DATA_PROCESSING_AGREEMENT" | "TENANT_TERMS_OF_SERVICE";

export interface LegalDocData { documentType: LegalDocType; title: string; version?: string; content: string; }

/** Fetch the ACTIVE legal document (PDPA / Terms) for the consent modal. */
export async function fetchLegalDocument(
  apiUrl: string,
  documentType: LegalDocType,
): Promise<LegalDocData | null> {
  try {
    const res = await fetch(`${apiUrl}/api/legal-documents/${documentType}/active`);
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; data?: LegalDocData };
    return data?.success && data.data ? data.data : null;
  } catch {
    return null;
  }
}

/** Record a per-document consent/T&C decision (PDPA audit). Fire-and-forget. */
export async function recordDocConsent(
  embedKey:     string,
  apiUrl:       string,
  sessionId:    string,
  given:        boolean,
  documentType: LegalDocType,
  version?:     string,
): Promise<void> {
  try {
    await fetch(`${apiUrl}/api/widget/consent`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: embedKey, sessionId, given, documentType, version }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function recordConsent(
  embedKey:  string,
  apiUrl:    string,
  sessionId: string,
  given:     boolean,
): Promise<void> {
  try {
    await fetch(`${apiUrl}/api/widget/consent`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: embedKey, sessionId, given }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function createCheckout(
  embedKey:  string,
  apiUrl:    string,
  productId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/widget/checkout`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: embedKey, productId }),
    });
    if (!res.ok) return null;
    const data = await parseWidgetJsonResponse<{ ok: boolean; url?: string }>(res);
    return data?.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

export interface AdminMessage {
  role:      "admin";
  content:   string;
  timestamp: string;
}

export async function pollUpdates(
  embedKey:  string,
  apiUrl:    string,
  sessionId: string,
  since:     string,
): Promise<{ messages: AdminMessage[]; botStatus: string }> {
  try {
    const url = `${apiUrl}/api/widget/updates?key=${encodeURIComponent(embedKey)}&sessionId=${encodeURIComponent(sessionId)}&since=${encodeURIComponent(since)}`;
    const res = await fetch(url);
    if (!res.ok) return { messages: [], botStatus: "handoff_active" };
    const data = await parseWidgetJsonResponse<{ messages: AdminMessage[]; botStatus: string }>(res);
    return data ?? { messages: [], botStatus: "handoff_active" };
  } catch {
    return { messages: [], botStatus: "handoff_active" };
  }
}
