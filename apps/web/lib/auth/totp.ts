/**
 * TOTP (Time-based One-Time Password) — RFC 6238
 * Self-contained implementation using Web Crypto API.
 * No external dependencies.
 */

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Uint8Array {
  const str   = input.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits  = 0;
  let value = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = BASE32_CHARS.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** Generate a cryptographically random TOTP secret (20 bytes → 32 base32 chars) */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Compute HOTP value for a given key and counter */
async function hotp(secret: string, counter: number): Promise<number> {
  const keyBytes = base32Decode(secret);

  // Need an ArrayBuffer for importKey
  const keyBuffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // Counter as 8-byte big-endian buffer
  const counterBuf = new ArrayBuffer(8);
  const view       = new DataView(counterBuf);
  view.setUint32(4, counter >>> 0, false);

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBuf);
  const hmac      = new Uint8Array(signature);

  const offset = hmac[19] & 0xf;
  const code   =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff);

  return code % 1_000_000;
}

/** Generate current TOTP code (30-second window) */
export async function generateTotp(secret: string): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const code    = await hotp(secret, counter);
  return String(code).padStart(6, "0");
}

/**
 * Verify a user-submitted TOTP code.
 * Accepts current window ±1 (90-second tolerance for clock skew).
 */
export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const userCode = parseInt(cleaned, 10);

  const counter = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [-1, 0, 1]) {
    const expected = await hotp(secret, counter + delta);
    if (expected === userCode) return true;
  }
  return false;
}

/** Build an otpauth:// URI for QR code display */
export function buildOtpAuthUri(
  secret:  string,
  email:   string,
  issuer = "Zudobot",
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits:    "6",
    period:    "30",
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
}
