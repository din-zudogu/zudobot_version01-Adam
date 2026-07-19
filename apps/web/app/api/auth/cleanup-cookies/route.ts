import { NextResponse } from "next/server";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

/** Clears short-lived Zudo registration cookies (httpOnly-safe). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secure = AMPLIFY_CONFIG.authUrl.startsWith("https://");

  for (const name of ["zudo-onboarded", "zudo-pdpa-consent"]) {
    res.cookies.set(name, "", {
      httpOnly: name === "zudo-onboarded",
      secure,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  }

  return res;
}
