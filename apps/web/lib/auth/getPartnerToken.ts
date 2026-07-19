import { getServerToken } from "./getServerToken";
import type { NextRequest } from "next/server";

/** Returns the session token only if the caller is a partner_admin (primary or secondary role). */
export async function getPartnerToken(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token) return null;
  const roles = [...(((token as { roles?: string[] }).roles) ?? [])];
  if (token.role !== "partner_admin" && !roles.includes("partner_admin")) return null;
  return token;
}
