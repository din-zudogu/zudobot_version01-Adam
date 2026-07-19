import type { NextRequest } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getPlatformTenantId } from "@/lib/platform/platformTenant";

const PLATFORM_KB_HEADER = "x-zudobot-platform-knowledge";

function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Resolves tenantId for knowledge APIs.
 * - Default: logged-in tenant (token.sub)
 * - Header x-zudobot-platform-knowledge: 1 + admin role → the platform sales/support bot.
 *   Prefers the GLOBAL chat tenant (System B — the bot the zudobot.zudogu.com widget
 *   reads RAG from, configured at /admin/zudobot-config). Falls back to the legacy
 *   Zudo Guide tenant when PLATFORM_GLOBAL_CHAT_TENANT_ID is not set, so older setups
 *   keep working unchanged.
 */
export async function resolveKnowledgeTenantId(
  req: NextRequest,
): Promise<{ tenantId: string } | { error: "unauthorized" | "forbidden" | "platform_not_configured" }> {
  const token = await getServerToken(req);
  if (!token?.sub && !isAdminRole(token?.role as string)) {
    return { error: "unauthorized" };
  }

  if (req.headers.get(PLATFORM_KB_HEADER) === "1") {
    if (!isAdminRole(token?.role as string)) {
      return { error: "forbidden" };
    }
    const globalChatTenantId = process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim();
    if (globalChatTenantId) {
      return { tenantId: globalChatTenantId };
    }
    const platformTenantId = await getPlatformTenantId();
    if (!platformTenantId) {
      return { error: "platform_not_configured" };
    }
    return { tenantId: platformTenantId };
  }

  if (!token?.sub) {
    return { error: "unauthorized" };
  }
  return { tenantId: token.sub };
}
