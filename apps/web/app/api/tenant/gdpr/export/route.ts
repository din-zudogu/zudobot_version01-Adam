/**
 * GET /api/tenant/gdpr/export?format=json|csv
 *
 * Exports all conversation data for this tenant.
 * GDPR Right of Access (Article 15).
 * Returns anonymized session records (no raw PII beyond what's stored in messages).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

function toCSV(sessions: ReturnType<typeof formatSession>[]): string {
  const headers = ["sessionId","endUserId","botStatus","consentGiven","consentAt","createdAt","lastActiveAt","expiresAt","messageCount","handoffRequested","handoffAt"];
  const rows = sessions.map((s) => headers.map((h) => {
    const v = (s as Record<string, unknown>)[h];
    if (v === null || v === undefined) return "";
    const str = String(v);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function formatSession(s: {
  sessionId: string;
  endUserId?: string;
  botStatus: string;
  consentGiven?: boolean;
  consentAt?: Date;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  messages: { role: string; content: string; timestamp: Date }[];
  handoffRequested: boolean;
  handoffAt?: Date;
}) {
  return {
    sessionId:        s.sessionId,
    endUserId:        s.endUserId ?? null,
    botStatus:        s.botStatus,
    consentGiven:     s.consentGiven ?? null,
    consentAt:        s.consentAt?.toISOString() ?? null,
    createdAt:        s.createdAt.toISOString(),
    lastActiveAt:     s.lastActiveAt.toISOString(),
    expiresAt:        s.expiresAt.toISOString(),
    messageCount:     s.messages.length,
    handoffRequested: s.handoffRequested,
    handoffAt:        s.handoffAt?.toISOString() ?? null,
    messages:         s.messages.map((m) => ({
      role:      m.role,
      content:   m.content,
      timestamp: m.timestamp.toISOString(),
    })),
  };
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  if (!["json", "csv"].includes(format)) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const tenantId = token.sub;

  try {
    await connectDB();

    const sessions = await ConversationSessionModel
      .find({ tenantId })
      .select("sessionId endUserId botStatus consentGiven consentAt lastActiveAt expiresAt messages handoffRequested handoffAt createdAt")
      .sort({ lastActiveAt: -1 })
      .limit(5000)
      .lean();

    const formatted = sessions.map((s) => formatSession({
      sessionId:        s.sessionId,
      endUserId:        s.endUserId,
      botStatus:        s.botStatus,
      consentGiven:     s.consentGiven,
      consentAt:        s.consentAt,
      createdAt:        s.createdAt as Date,
      lastActiveAt:     s.lastActiveAt,
      expiresAt:        s.expiresAt,
      messages:         s.messages as { role: string; content: string; timestamp: Date }[],
      handoffRequested: s.handoffRequested,
      handoffAt:        s.handoffAt,
    }));

    const exportedAt = new Date().toISOString();

    if (format === "csv") {
      const csv = toCSV(formatted);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="zudobot-data-export-${exportedAt.slice(0,10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      exportedAt,
      tenantId,
      totalSessions: formatted.length,
      sessions:      formatted,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
