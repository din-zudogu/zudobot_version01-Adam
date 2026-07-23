import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import {
  createExtensionAccessToken,
  type ExtensionAuthContext,
} from "@/lib/integration/extensionAuth";

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
};

function allowedGoogleAudiences(): string[] {
  return [
    process.env.GOOGLE_EXTENSION_OAUTH_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
    process.env.CLIENT_ID,
  ].filter((v): v is string => !!v?.trim());
}

export type GoogleTokenVerifyResult =
  | { ok: true; ctx: ExtensionAuthContext; email: string }
  | { ok: false; error: string };

/**
 * Verify Google access token from chrome.identity.getAuthToken (Path 2).
 * Returns a specific error reason (logged server-side, and safe to surface
 * to the extension) instead of collapsing every failure into one opaque
 * "invalid_google_token" — that made a real client_id/audience mismatch
 * indistinguishable from "no matching Zudobot account" or "token expired".
 */
export async function verifyGoogleAccessToken(
  googleAccessToken: string
): Promise<GoogleTokenVerifyResult> {
  const token = googleAccessToken.trim();
  if (!token) return { ok: false, error: "empty_google_token" };

  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!infoRes.ok) {
    return { ok: false, error: "google_tokeninfo_unreachable" };
  }

  const info = (await infoRes.json()) as GoogleTokenInfo;
  if (!info.email) return { ok: false, error: "google_email_missing" };

  const verified =
    info.email_verified === true ||
    info.email_verified === "true" ||
    info.email_verified === undefined;
  if (!verified) return { ok: false, error: "google_email_unverified" };

  const audiences = allowedGoogleAudiences();
  if (audiences.length > 0 && info.aud && !audiences.includes(info.aud)) {
    console.warn(
      `[googleExtensionAuth] audience mismatch: token aud=${info.aud} not in [${audiences.join(", ")}]`
    );
    return { ok: false, error: "google_audience_mismatch" };
  }

  if (info.exp) {
    const expSec = Number(info.exp);
    if (!Number.isNaN(expSec) && expSec < Math.floor(Date.now() / 1000)) {
      return { ok: false, error: "google_token_expired" };
    }
  }

  await connectDB();
  const user = await UserModel.findOne({
    email: info.email.toLowerCase().trim(),
  }).lean();
  if (!user) return { ok: false, error: "account_not_found" };

  const role =
    user.role === "tenant" || user.role === "admin" || user.role === "super_admin"
      ? user.role
      : null;
  if (!role) return { ok: false, error: "role_not_allowed" };

  return {
    ok: true,
    email: info.email,
    ctx: {
      sub: String(user._id),
      role,
    },
  };
}

export function issueExtensionSession(ctx: ExtensionAuthContext) {
  return createExtensionAccessToken(ctx);
}
