import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { CustomPackageModel } from "@/lib/db/models/CustomPackage";
import {
  QUOTA_ADDON_CATALOG,
  MEMORY_ADDON_CATALOG,
  RETENTION_ADDON_CATALOG,
} from "@/lib/payment/pmRules";
import type {
  QuotaAddonId,
  MemoryAddonId,
  RetentionAddonId,
} from "@/lib/payment/pmRules";

function generateCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(36).toUpperCase().padStart(2, "0"))
    .join("")
    .slice(0, 8);
  return `ZCP-${date}-${rand}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: string;
      quotaAddonId?: string;
      memoryAddonId?: string;
      retentionAddonId?: string;
    };

    const name            = (body.name ?? "").trim();
    const quotaAddonId    = body.quotaAddonId    ?? "none";
    const memoryAddonId   = body.memoryAddonId   ?? "free";
    const retentionAddonId= body.retentionAddonId ?? "standard";

    if (!name) {
      return NextResponse.json({ ok: false, error: "กรุณาตั้งชื่อแพ็กเกจ" }, { status: 400 });
    }

    // Validate IDs against catalogs
    const quotaEntry    = QUOTA_ADDON_CATALOG[quotaAddonId as QuotaAddonId];
    const memoryEntry   = MEMORY_ADDON_CATALOG[memoryAddonId as MemoryAddonId];
    const retentionEntry= RETENTION_ADDON_CATALOG[retentionAddonId as RetentionAddonId];

    if (!quotaEntry || !memoryEntry || !retentionEntry) {
      return NextResponse.json({ ok: false, error: "รหัสแพ็กเกจไม่ถูกต้อง" }, { status: 400 });
    }

    const quotaPrice    = quotaEntry.priceThb;
    const memoryPrice   = memoryEntry.priceThb;
    const retentionRaw  = retentionEntry.priceThb;
    const retentionPrice= retentionRaw < 0 ? 0 : retentionRaw;
    const totalPrice    = quotaPrice + memoryPrice + retentionPrice;

    await connectDB();

    // Generate unique code — retry once on collision (extremely rare)
    let code = generateCode();
    const exists = await CustomPackageModel.exists({ code });
    if (exists) code = generateCode();

    const pkg = await CustomPackageModel.create({
      code,
      name,
      quotaAddonId,
      memoryAddonId,
      retentionAddonId,
      totalPrice,
      status: "draft",
    });

    return NextResponse.json({ ok: true, code: pkg.code, totalPrice });
  } catch (err) {
    console.error("[custom-package]", err);
    return NextResponse.json({ ok: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
