/**
 * GET   /api/v1/admin/bot-config  — fetch bot persona + scope config
 * PATCH /api/v1/admin/bot-config  — update bot persona + scope config
 * Auth: x-secret-key only (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import BotConfigModel from "@/models/botConfig";

function requireSecret(auth: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!auth.ok) return false;
  return auth.keyType === "secret";
}

const TONE_VALUES = ["FRIENDLY", "PROFESSIONAL", "PLAYFUL"] as const;
const LANG_VALUES = ["th", "en", "both"] as const;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  await dbConnect();
  const config = await BotConfigModel.findOne({ tenantId: auth.tenant._id }).lean();

  return NextResponse.json({
    ok: true,
    data: config ?? {
      botName:            "Zudobot",
      botIntro:           "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ? 😊",
      toneOfVoice:        "FRIENDLY",
      primaryLanguage:    "th",
      customKnowledge:    "",
      maxDiscountPercent: 10,
      forbiddenTopics:    [],
      handoffMessage:     "ได้แจ้งทีมงานให้ติดต่อกลับโดยเร็วที่สุดเลยนะคะ 🙏",
      themeColor:         "#6366f1",
      logoUrl:            "",
      position:           "bottom-right",
    },
  }, { headers: cors });
}

export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const b = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (typeof b.botName         === "string") update.botName         = b.botName.trim().slice(0, 100);
  if (typeof b.botAvatar       === "string") update.botAvatar       = b.botAvatar.trim().slice(0, 10);
  if (typeof b.backstory       === "string") update.backstory       = b.backstory.slice(0, 1000);
  if (typeof b.botIntro        === "string") update.botIntro        = b.botIntro.trim().slice(0, 500);
  if (typeof b.customKnowledge === "string") update.customKnowledge = b.customKnowledge.slice(0, 5000);
  if (typeof b.handoffMessage  === "string") update.handoffMessage  = b.handoffMessage.slice(0, 300);
  if (typeof b.shippingPolicy  === "string") update.shippingPolicy  = b.shippingPolicy.slice(0, 1000);
  if (typeof b.returnPolicy    === "string") update.returnPolicy    = b.returnPolicy.slice(0, 1000);
  if (typeof b.themeColor      === "string") update.themeColor      = b.themeColor.trim();
  if (typeof b.logoUrl         === "string") update.logoUrl         = b.logoUrl.trim();
  if (typeof b.autoOpenDelay   === "number") update.autoOpenDelay   = Math.max(0, b.autoOpenDelay);
  if (typeof b.maxMessagesPerSession === "number") {
    update.maxMessagesPerSession = Math.min(200, Math.max(1, b.maxMessagesPerSession));
  }
  if (typeof b.maxDiscountPercent === "number") {
    update.maxDiscountPercent = Math.max(0, Math.min(100, b.maxDiscountPercent));
  }
  if (TONE_VALUES.includes(b.toneOfVoice as typeof TONE_VALUES[number])) {
    update.toneOfVoice = b.toneOfVoice;
  }
  if (LANG_VALUES.includes(b.primaryLanguage as typeof LANG_VALUES[number])) {
    update.primaryLanguage = b.primaryLanguage;
  }
  if (Array.isArray(b.forbiddenTopics)) {
    update.forbiddenTopics = b.forbiddenTopics.map(String).slice(0, 50);
  }
  if (["bottom-right", "bottom-left"].includes(String(b.position))) {
    update.position = b.position;
  }
  if (Array.isArray(b.quickReplies)) {
    update.quickReplies = (b.quickReplies as string[]).map(String).slice(0, 5);
  }
  // Operating hours
  if (b.operatingHours && typeof b.operatingHours === "object") {
    const oh = b.operatingHours as Record<string, unknown>;
    if (typeof oh.enabled        === "boolean") update["operatingHours.enabled"]        = oh.enabled;
    if (typeof oh.timezone       === "string")  update["operatingHours.timezone"]       = oh.timezone;
    if (typeof oh.offlineMessage === "string")  update["operatingHours.offlineMessage"] = oh.offlineMessage.slice(0, 300);
    if (Array.isArray(oh.schedule)) {
      update["operatingHours.schedule"] = (oh.schedule as Array<Record<string, unknown>>)
        .filter((s) => typeof s.day === "number")
        .map((s) => ({ day: s.day, open: String(s.open || "09:00"), close: String(s.close || "21:00") }))
        .slice(0, 7);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400, headers: cors });
  }

  await dbConnect();
  const updated = await BotConfigModel.findOneAndUpdate(
    { tenantId: auth.tenant._id },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  return NextResponse.json({ ok: true, data: updated }, { headers: cors });
}
