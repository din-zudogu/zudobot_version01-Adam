/**
 * /api/v1/custom-commands
 * CRUD for tenant custom commands (Layer 3 system-prompt injections).
 * Auth: x-secret-key
 *
 * GET    — list all commands for tenant
 * POST   — create new command (with svc_zudobotrules pre-scan warning)
 * PATCH  — update command by ?id=
 * DELETE — delete command by ?id=
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import CustomCommandModel from "@/models/customCommand";
import { zudobotRules } from "@/services/svc_zudobotrules";
import type { CommandType } from "@/models/customCommand";

const ALLOWED_TYPES: CommandType[] = ["SYSTEM_PROMPT_ADDON", "AUTO_REPLY", "SALES_STRATEGY"];

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Scan commandContent for constitutional rule violations and return a warning string. */
function validateContent(content: string): string {
  const check = zudobotRules.checkInput({ role: "user", text: content });
  if (!check.pass) {
    return `⚠ Content may violate rules: ${check.violatedRules.join(", ")}. The command may be silently ignored at runtime.`;
  }
  return "";
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* ── GET ──────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  await dbConnect();
  const tenantId = String(auth.tenant._id);
  const commands = await CustomCommandModel
    .find({ tenantId })
    .sort({ priority: -1, createdAt: 1 })
    .lean();

  return new Response(JSON.stringify({ success: true, data: commands }), {
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/* ── POST ─────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400, cors); }

  const b = body as Record<string, unknown>;
  const commandType    = String(b.commandType || "").trim() as CommandType;
  const label          = String(b.label || "").trim().slice(0, 200);
  const commandContent = String(b.commandContent || "").trim().slice(0, 3000);
  const priority       = Math.min(100, Math.max(1, Number(b.priority) || 50));
  const isActive       = b.isActive !== false;
  const triggerKeywords = Array.isArray(b.triggerKeywords)
    ? (b.triggerKeywords as string[]).map((k) => String(k).trim()).filter(Boolean).slice(0, 20)
    : [];

  if (!ALLOWED_TYPES.includes(commandType)) return err("Invalid commandType", 400, cors);
  if (!label)          return err("label is required", 400, cors);
  if (!commandContent) return err("commandContent is required", 400, cors);

  await dbConnect();

  const tenantId        = String(auth.tenant._id);
  const validationWarning = validateContent(commandContent);

  const cmd = await CustomCommandModel.create({
    tenantId, commandType, label, commandContent,
    priority, isActive, triggerKeywords, validationWarning,
  });

  return new Response(JSON.stringify({ success: true, data: cmd, validationWarning }), {
    status: 201,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/* ── PATCH ────────────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err("id query param required", 400, cors);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400, cors); }

  const b = body as Record<string, unknown>;
  await dbConnect();

  const tenantId = String(auth.tenant._id);
  const cmd = await CustomCommandModel.findOne({ _id: id, tenantId });
  if (!cmd) return err("Not found", 404, cors);

  if (b.commandType !== undefined && ALLOWED_TYPES.includes(b.commandType as CommandType)) {
    cmd.commandType = b.commandType as CommandType;
  }
  if (typeof b.label          === "string") cmd.label          = b.label.slice(0, 200);
  if (typeof b.priority       === "number") cmd.priority       = Math.min(100, Math.max(1, b.priority));
  if (typeof b.isActive       === "boolean") cmd.isActive      = b.isActive;
  if (Array.isArray(b.triggerKeywords)) {
    cmd.triggerKeywords = (b.triggerKeywords as string[]).map((k) => String(k).trim()).filter(Boolean).slice(0, 20);
  }
  if (typeof b.commandContent === "string") {
    cmd.commandContent    = b.commandContent.slice(0, 3000);
    cmd.validationWarning = validateContent(cmd.commandContent);
  }
  cmd.updatedBy = "admin";
  await cmd.save();

  return new Response(JSON.stringify({ success: true, data: cmd, validationWarning: cmd.validationWarning }), {
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/* ── DELETE ───────────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err("id query param required", 400, cors);

  await dbConnect();
  const tenantId = String(auth.tenant._id);
  const result   = await CustomCommandModel.deleteOne({ _id: id, tenantId });
  if (result.deletedCount === 0) return err("Not found", 404, cors);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Export interpolate so chat/message can use it at runtime
