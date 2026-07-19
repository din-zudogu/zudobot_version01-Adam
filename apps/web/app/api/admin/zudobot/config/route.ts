import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ZudobotConfig } from "@/lib/db/models/ZudobotConfig";

export const dynamic = "force-dynamic";

function normalizeDomain(raw: string): string | null {
  try {
    const value = raw.trim();
    if (!value) return null;
    const url = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname.includes(".") || hostname.includes(" ")) return null;
    return hostname;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.MONGO_URI) {
    throw new Error("CRITICAL: MONGO_URI missing from AWS Amplify runtime");
  }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  const config = await ZudobotConfig.findOne({ tenantId }).lean();
  return NextResponse.json({
    success: true,
    data: config ?? {
      tenantId,
      botName: "Zudobot",
      welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ",
      themeColor: "#3B82F6",
      whitelistedDomains: [],
    },
  });
}

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.MONGO_URI) {
    throw new Error("CRITICAL: MONGO_URI missing from AWS Amplify runtime");
  }

  const body = (await req.json().catch(() => null)) as
    | {
        tenantId?: string;
        botName?: string;
        welcomeMessage?: string;
        themeColor?: string;
        whitelistedDomains?: string[];
      }
    | null;

  if (!body?.tenantId) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  const normalizedDomains = (body.whitelistedDomains ?? [])
    .map((domain) => normalizeDomain(domain))
    .filter((domain): domain is string => Boolean(domain));

  await connectDB();
  const config = await ZudobotConfig.findOneAndUpdate(
    { tenantId: body.tenantId },
    {
      $set: {
        botName: body.botName?.trim() || "Zudobot",
        welcomeMessage: body.welcomeMessage?.trim() || "สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ",
        themeColor: body.themeColor?.trim() || "#3B82F6",
        whitelistedDomains: Array.from(new Set(normalizedDomains)),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return NextResponse.json({ success: true, data: config });
}
