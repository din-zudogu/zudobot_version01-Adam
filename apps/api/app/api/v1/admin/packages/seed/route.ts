/**
 * POST /api/v1/admin/packages/seed
 * Seeds the PackageConfig collection with default Zudobot packages.
 * Safe to run multiple times (upsert by slug).
 * Auth: x-secret-key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import PackageConfigModel from "@/models/packageConfig";

const DEFAULT_PACKAGES = [
  // ── Base Plans ────────────────────────────────────────────────────────────
  {
    slug: "trial", packageType: "BASE_PLAN", name: "Trial", billingCycle: "monthly",
    description: "ทดลองใช้ฟรี 100 ข้อความ ไม่จำลูกค้า",
    price: 0, messageQuota: 100, visitorMemoryQuota: 0, sortOrder: 0,
  },
  {
    slug: "starter_monthly", packageType: "BASE_PLAN", name: "Starter", billingCycle: "monthly",
    description: "2,000 ข้อความ/เดือน จำลูกค้าได้ 500 คน",
    price: 490, messageQuota: 2000, visitorMemoryQuota: 500, sortOrder: 1,
  },
  {
    slug: "pro_monthly", packageType: "BASE_PLAN", name: "Pro", billingCycle: "monthly",
    description: "10,000 ข้อความ/เดือน จำลูกค้าได้ 5,000 คน",
    price: 990, messageQuota: 10000, visitorMemoryQuota: 5000, sortOrder: 2,
  },
  {
    slug: "enterprise_monthly", packageType: "BASE_PLAN", name: "Enterprise", billingCycle: "monthly",
    description: "ข้อความไม่จำกัด จำลูกค้าได้ไม่จำกัด",
    price: 0, messageQuota: 999999, visitorMemoryQuota: 999999, sortOrder: 3,
  },
  // ── Message Addons ────────────────────────────────────────────────────────
  {
    slug: "addon_msg_1000", packageType: "ADDON_MESSAGES", name: "Extra 1,000 Messages", billingCycle: "one_time",
    description: "เพิ่มโควต้าข้อความ 1,000 ข้อความ (ไม่หมดอายุ)",
    price: 99, messageQuota: 1000, visitorMemoryQuota: 0, sortOrder: 10,
  },
  {
    slug: "addon_msg_5000", packageType: "ADDON_MESSAGES", name: "Extra 5,000 Messages", billingCycle: "one_time",
    description: "เพิ่มโควต้าข้อความ 5,000 ข้อความ (ไม่หมดอายุ)",
    price: 399, messageQuota: 5000, visitorMemoryQuota: 0, sortOrder: 11,
  },
  // ── Memory Addons ─────────────────────────────────────────────────────────
  {
    slug: "addon_mem_500", packageType: "ADDON_MEMORY", name: "Extra Memory 500 Customers", billingCycle: "one_time",
    description: "จำลูกค้าเพิ่ม 500 คน (ไม่หมดอายุ)",
    price: 149, messageQuota: 0, visitorMemoryQuota: 500, sortOrder: 20,
  },
  {
    slug: "addon_mem_2000", packageType: "ADDON_MEMORY", name: "Extra Memory 2,000 Customers", billingCycle: "one_time",
    description: "จำลูกค้าเพิ่ม 2,000 คน (ไม่หมดอายุ)",
    price: 499, messageQuota: 0, visitorMemoryQuota: 2000, sortOrder: 21,
  },
];

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  await dbConnect();

  const results = await Promise.all(
    DEFAULT_PACKAGES.map((pkg) =>
      PackageConfigModel.findOneAndUpdate(
        { slug: pkg.slug },
        { $set: { ...pkg, isActive: true } },
        { upsert: true, new: true }
      ).lean()
    )
  );

  return NextResponse.json({
    ok: true,
    message: `Seeded ${results.length} packages.`,
    packages: results.map((p) => ({ slug: p?.slug, name: p?.name, price: p?.price })),
  }, { headers: cors });
}
