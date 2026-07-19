const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{13}\b/g, replacement: "***" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "**** **** **** ****" },
  { pattern: /\b\d{6}\b/g, replacement: "******" },
  { pattern: /\b(?:\+66|0)\s*\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g, replacement: "+xx xxx xxxx" },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "***@***.***" },
  { pattern: /(password|pwd|pass|รหัสผ่าน|รหัส)\s*[:=]\s*\S+/gi, replacement: "$1: [REDACTED]" },
  { pattern: /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, replacement: "*** *** ****" },
];

export function containsPII(text: string): boolean {
  if (!text) return false;
  return PII_PATTERNS.some((entry) => entry.pattern.test(text));
}

export function redactPII(text: string): string {
  if (!text) return text;
  let sanitized = String(text);
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function sanitizeChatMessages(messages: Array<{ role: string; content: string }>) {
  return messages.map((message) => ({
    ...message,
    content: redactPII(message.content || ""),
  }));
}
