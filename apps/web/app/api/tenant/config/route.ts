import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ConfigModel } from "@/lib/db/models/Config";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const configs = await ConfigModel.find({ tenantId: token.sub }).lean();
    return NextResponse.json({ configs });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { key: string; value: string | number | boolean | Record<string, unknown> | null; type: string; description?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const { key, value, type, description } = body;
  if (!key || value === undefined || !type) {
    return NextResponse.json({ error: "key, value, type required" }, { status: 400 });
  }

  try {
    await connectDB();
    const config = await ConfigModel.findOneAndUpdate(
      { tenantId: token.sub, key },
      {
        value,
        type,
        description,
        updatedBy: token.sub,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}