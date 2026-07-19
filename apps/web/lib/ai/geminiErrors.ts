export type GeminiErrorKind =
  | "quota_exhausted"
  | "missing_api_key"
  | "auth_failed"
  | "model_not_found"
  | "precondition_error"
  | "service_unavailable"
  | "unknown";

export interface ParsedGeminiError {
  kind: GeminiErrorKind;
  code: string;
  userMessageTh: string;
  detail: string;
  httpStatus: number;
  isRetryable: boolean;
}

/** Server-side only — full Gemini/API context for logs (never send to clients). */
export function formatGeminiErrorDetail(err: unknown): string {
  if (err == null) return "unknown";

  if (err instanceof Error) {
    const parts: string[] = [err.name ? `${err.name}: ${err.message}` : err.message];
    const extra = err as Error & {
      status?: number | string;
      statusText?: string;
      code?: string | number;
      cause?: unknown;
    };
    if (extra.status != null) parts.push(`status=${extra.status}`);
    if (extra.statusText) parts.push(`statusText=${extra.statusText}`);
    if (extra.code != null) parts.push(`code=${extra.code}`);
    if (extra.cause != null) parts.push(`cause=${formatGeminiErrorDetail(extra.cause)}`);
    return parts.filter(Boolean).join(" | ");
  }

  if (typeof err === "object") {
    try {
      const o = err as Record<string, unknown>;
      const msg = o.message ?? o.error ?? o.statusText;
      const status = o.status ?? o.statusCode;
      const parts: string[] = [];
      if (status != null) parts.push(`status=${status}`);
      if (msg != null) parts.push(String(msg));
      if (parts.length > 0) return parts.join(" | ");
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(err);
}

function readErrorSignals(err: unknown): { message: string; status?: number } {
  let message = "";
  let status: number | undefined;

  if (err instanceof Error) {
    const extra = err as Error & { status?: number; statusCode?: number };
    message = err.message.toLowerCase();
    status =
      typeof extra.status     === "number" ? extra.status :
      typeof extra.statusCode === "number" ? extra.statusCode :
      undefined;
  } else if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    status =
      typeof o.status     === "number" ? o.status :
      typeof o.statusCode === "number" ? o.statusCode :
      undefined;
    message = String(o.message ?? o.error ?? "").toLowerCase();
  } else {
    message = String(err).toLowerCase();
  }

  // Gemini SDK embeds HTTP status in the message text, e.g. "(400 Bad Request)".
  // Extract it as a fallback when the error object has no numeric status property.
  if (status == null) {
    const m = message.match(/\((\d{3})\s/);
    if (m) {
      const code = parseInt(m[1], 10);
      if (code >= 400) status = code;
    }
  }

  return { message, status };
}

export function parseGeminiError(err: unknown): ParsedGeminiError {
  const detail = formatGeminiErrorDetail(err);
  const { message, status } = readErrorSignals(err);

  if (/GEMINI_API_KEY not set|GEMINI_API_KEY_MISSING|gemini_not_configured/i.test(detail)) {
    return {
      kind: "missing_api_key",
      code: "gemini_not_configured",
      userMessageTh: "ระบบ AI ยังไม่ได้ตั้งค่า API key — ติดต่อผู้ดูแลระบบ",
      detail,
      httpStatus: 503,
      isRetryable: false,
    };
  }

  if (
    message.includes("quota") ||
    status === 429 ||
    /429|too many requests|depleted|quota exceeded|resource_exhausted/i.test(detail)
  ) {
    return {
      kind: "quota_exhausted",
      code: "gemini_quota_exhausted",
      userMessageTh:
        "ระบบประมวลผลข้อความชั่วคราวเต็ม (Quota Exhausted) กรุณารอ 1 นาทีแล้วกดใหม่อีกครั้ง",
      detail,
      httpStatus: 503,
      isRetryable: true,
    };
  }

  if (
    message.includes("key") ||
    message.includes("api key") ||
    status === 401 ||
    status === 403
  ) {
    return {
      kind: "auth_failed",
      code: "gemini_auth_failed",
      userMessageTh:
        "การยืนยันสิทธิ์เชื่อมต่อระบบ AI ขัดข้อง (Invalid API Key) กรุณาแจ้งผู้ดูแลระบบเพื่อตรวจสอบ",
      detail,
      httpStatus: 503,
      isRetryable: false,
    };
  }

  if (/first content should be with role|invalid.*history|history.*invalid|role.*user.*model|role.*model.*user/i.test(detail)) {
    return {
      kind: "unknown",
      code: "gemini_invalid_history",
      userMessageTh: "ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
      detail,
      httpStatus: 500,
      isRetryable: true,
    };
  }

  if (message.includes("not found") || status === 404) {
    return {
      kind: "model_not_found",
      code: "gemini_model_not_found",
      userMessageTh: "โมเดล AI ที่กำหนดไว้ไม่รองรับในขณะนี้ — กรุณาแจ้งผู้ดูแลระบบ",
      detail,
      httpStatus: 503,
      isRetryable: false,
    };
  }

  if (
    status === 400 ||
    /failed_precondition|billing|location is not supported|does not have permission|invalid.?argument|bad request/i.test(detail)
  ) {
    return {
      kind: "precondition_error",
      code: "gemini_precondition_error",
      userMessageTh: "ระบบ AI ไม่สามารถประมวลผลได้ในขณะนี้ กรุณาติดต่อผู้ดูแลระบบ",
      detail,
      httpStatus: 503,
      isRetryable: false,
    };
  }

  if (
    status === 500 ||
    status === 503 ||
    /500|503|internal server error|service unavailable|overloaded|backend error|deadline.?exceeded|upstream/i.test(detail)
  ) {
    return {
      kind: "service_unavailable",
      code: "gemini_service_unavailable",
      userMessageTh: "ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่",
      detail,
      httpStatus: 503,
      isRetryable: true,
    };
  }

  return {
    kind: "unknown",
    code: "gemini_error",
    userMessageTh: "ระบบ AI ตอบสนองผิดปกติ กรุณาลองใหม่ หรือติดต่อผู้ดูแลระบบ",
    detail,
    httpStatus: 500,
    isRetryable: true,
  };
}
