import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

export function getServerToken(req: NextRequest) {
  const secret = AMPLIFY_CONFIG.authSecret;
  const secureCookie = AMPLIFY_CONFIG.authUrl.startsWith("https://");
  return getToken({ req, secret, secureCookie });
}
