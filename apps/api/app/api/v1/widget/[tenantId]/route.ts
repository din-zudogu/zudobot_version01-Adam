/**
 * GET /api/v1/widget/[tenantId]
 * Public endpoint — returns widget configuration for the embed script.
 * No auth required (tenantId is public). Domain check is applied.
 */

import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connect";
import TenantModel from "@/models/tenant";
import BotConfigModel from "@/models/botConfig";

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const origin = req.headers.get("origin") || "*";
  const headers = cors(origin);

  const { tenantId } = params;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenantId required" }), { status: 400, headers });
  }

  await dbConnect();

  const tenant = await TenantModel.findById(tenantId).lean();
  if (!tenant || !tenant.isActive) {
    return new Response(JSON.stringify({ error: "Tenant not found or inactive" }), { status: 404, headers });
  }

  // Domain whitelist check
  if (origin && origin !== "*" && tenant.allowedDomains?.length > 0) {
    try {
      const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      const reqHost = stripWww(new URL(origin).hostname);
      const allowed = tenant.allowedDomains.some((d) => {
        const clean = stripWww(d);
        return reqHost === clean || reqHost.endsWith("." + clean);
      });
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Domain not authorized" }), { status: 403, headers });
      }
    } catch { /* ignore invalid origin */ }
  }

  const config = await BotConfigModel.findOne({ tenantId }).lean();

  const widgetConfig = {
    tenantId,
    botName:       config?.botName       || "Zudobot",
    botAvatar:     config?.botAvatar     || "🤖",
    botIntro:      config?.botIntro      || "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ? 😊",
    themeColor:    config?.themeColor    || "#6366f1",
    logoUrl:       config?.logoUrl       || "",
    position:      config?.position      || "bottom-right",
    autoOpenDelay: config?.autoOpenDelay ?? 0,
    quickReplies:  config?.quickReplies  || [],
    maxMessagesPerSession: config?.maxMessagesPerSession ?? 20,
    operatingHours: config?.operatingHours ?? {
      enabled: false,
      timezone: "Asia/Bangkok",
      schedule: [],
      offlineMessage: "ขณะนี้ร้านปิดให้บริการแล้วค่ะ 🙏",
    },
  };

  return new Response(JSON.stringify({ config: widgetConfig }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
