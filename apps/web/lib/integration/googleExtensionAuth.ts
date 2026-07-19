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

/**
 * Verify Google access token from chrome.identity.getAuthToken (Path 2).
 */
export async function verifyGoogleAccessToken(
  googleAccessToken: string
): Promise<{ ctx: ExtensionAuthContext; email: string } | null> {
  const token = googleAccessToken.trim();
  if (!token) return null;

  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!infoRes.ok) return null;

  const info = (await infoRes.json()) as GoogleTokenInfo;
  if (!info.email) return null;

  const verified =
    info.email_verified === true ||
    info.email_verified === "true" ||
    info.email_verified === undefined;
  if (!verified) return null;

  const audiences = allowedGoogleAudiences();
  if (audiences.length > 0 && info.aud && !audiences.includes(info.aud)) {
    return null;
  }

  if (info.exp) {
    const expSec = Number(info.exp);
    if (!Number.isNaN(expSec) && expSec < Math.floor(Date.now() / 1000)) {
      return null;
    }
  }

  await connectDB();
  const user = await UserModel.findOne({
    email: info.email.toLowerCase().trim(),
  }).lean();
  if (!user) return null;

  const role =
    user.role === "tenant" || user.role === "admin" || user.role === "super_admin"
      ? user.role
      : null;
  if (!role) return null;

  return {
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
