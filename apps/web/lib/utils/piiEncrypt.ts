import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN    = 12; // GCM standard
const SEP       = ".";

function getKey(): Buffer {
  const hex = process.env.PII_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) throw new Error("PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}

export function encryptPII(plaintext: string): string {
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let enc      = cipher.update(plaintext, "utf8", "hex");
  enc         += cipher.final("hex");
  const tag    = cipher.getAuthTag().toString("hex");
  return [iv.toString("hex"), tag, enc].join(SEP);
}

export function decryptPII(ciphertext: string): string {
  const parts = ciphertext.split(SEP);
  if (parts.length !== 3) throw new Error("invalid_ciphertext");
  const [ivHex, tagHex, enc] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec  = decipher.update(enc, "hex", "utf8");
  dec     += decipher.final("utf8");
  return dec;
}

// ── Masking helpers ────────────────────────────────────────────────────────────

export function maskNationalId(id: string): string {
  // Thai ID: 1-XXXX-XXXXX-XX-X → show first segment + last check digit
  if (id.length !== 13) return "X".repeat(13);
  return `${id[0]}-${id.slice(1, 5)}-XXXXX-XX-${id[12]}`;
}

export function maskTaxId(id: string): string {
  if (id.length !== 13) return "X".repeat(13);
  return `${id[0]}-${id.slice(1, 5)}-XXXXX-XX-${id[12]}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 3)}-XXX-${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return email;
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}xxx${domain}`;
}

export function maskBankAccount(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return account;
  return `XXX-X-XX${digits.slice(-3)}-X`;
}
