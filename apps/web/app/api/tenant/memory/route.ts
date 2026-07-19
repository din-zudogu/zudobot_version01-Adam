import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { getMemoryUsage, clearTenantMemory } from "@/lib/memory/memoryService";

const BYTES_PER_MB = 1024 * 1024;

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const [usage, sub] = await Promise.all([
      getMemoryUsage(token.sub),
      SubscriptionModel.findOne({ tenantId: token.sub }),
    ]);

    let limitMb = 1; // trial default: 1 MB
    if (sub && sub.memoryAddonId !== "free") {
      const memPkg = await PackageConfigModel.findOne({ packageId: sub.memoryAddonId });
      if (memPkg?.memoryMb) limitMb = memPkg.memoryMb;
    }

    const percent = limitMb < 0 ? 0 : Math.min(100, Math.round((usage.usedBytes / (limitMb * BYTES_PER_MB)) * 100));

    return NextResponse.json({
      usedBytes:    usage.usedBytes,
      usedMb:       usage.usedMb,
      limitMb,
      percent,
      sessionCount: usage.sessionCount,
      unlimited:    limitMb < 0,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE — tenant self-service: clear all conversation memory
export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const deleted = await clearTenantMemory(token.sub);
    return NextResponse.json({ ok: true, sessionsDeleted: deleted });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
