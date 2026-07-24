import crypto from "crypto";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

// AES-256-GCM encryption for git-provider OAuth tokens / IAM keys at rest.
// Same scheme as lib/utils/piiEncrypt.ts, but with a dedicated key
// (GIT_OAUTH_TOKEN_ENCRYPTION_KEY, not PII_ENCRYPTION_KEY) so a leak of one
// key doesn't expose both PII and git-provider credentials.

const ALGORITHM = "aes-256-gcm";
const IV_LEN    = 12; // GCM standard
const SEP       = ".";

function getKey(): Buffer {
  const hex = AMPLIFY_CONFIG.gitOAuthTokenEncryptionKey;
  if (hex.length !== 64) throw new Error("GIT_OAUTH_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}

export function encryptGitToken(plaintext: string): string {
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let enc      = cipher.update(plaintext, "utf8", "hex");
  enc         += cipher.final("hex");
  const tag    = cipher.getAuthTag().toString("hex");
  return [iv.toString("hex"), tag, enc].join(SEP);
}

export function decryptGitToken(ciphertext: string): string {
  const parts = ciphertext.split(SEP);
  if (parts.length !== 3) throw new Error("invalid_ciphertext");
  const [ivHex, tagHex, enc] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec  = decipher.update(enc, "hex", "utf8");
  dec     += decipher.final("utf8");
  return dec;
}
