import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { UserModel } from "@/lib/db/models/User";

export const dynamic = "force-dynamic";

const TENANT_ID = "6a131c821296d01b12412734";
const MOCK_EMAIL = "mock-universal-embed@zudobot.internal";

function authorize(req: NextRequest): boolean {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.INTERNAL_CRON_SECRET?.trim();
  return Boolean(expected && secret && secret === expected);
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.MONGO_URI?.trim()) {
    throw new Error("MONGO_URI missing on runtime");
  }

  await connectDB();

  const existing = await TenantProfileModel.findOne({ tenantId: TENANT_ID }).lean();
  if (existing) {
    return NextResponse.json({
      ok: true,
      status: "already_exists",
      tenantId: existing.tenantId,
      embedKey: existing.embedKey,
      amplifyHint: `PLATFORM_GLOBAL_CHAT_TENANT_ID=${existing.tenantId}`,
    });
  }

  const oid = new mongoose.Types.ObjectId(TENANT_ID);
  const existingUser = await UserModel.findById(oid);
  if (!existingUser) {
    await UserModel.create({
      _id: oid,
      email: MOCK_EMAIL,
      name: "Mock Universal Embed Tenant",
      role: "tenant",
      roles: ["tenant"],
      tenantId: TENANT_ID,
      botState: "active",
      onboardingComplete: true,
    });
  }

  const embedKey = crypto.randomBytes(16).toString("hex");
  await TenantProfileModel.create({
    tenantId: TENANT_ID,
    businessName: "ร้านทดสอบ Universal Embed (Mock)",
    businessType: "ecommerce",
    websiteUrl: "https://mock-wordpress-demo.example.com",
    botName: "น้องซูโด (Mock)",
    botGender: "female",
    botTone: "friendly",
    welcomeMessage:
      "สวัสดีค่ะ ร้านทดสอบ Universal Embed ยินดีให้บริการค่ะ มีอะไรให้ช่วยไหมคะ?",
    widgetColor: "#3B82F6",
    widgetPosition: "bottom-right",
    widgetEnabled: false,
    allowedDomain: "",
    allowedDomains: [],
    embedKey,
    lineEnabled: false,
    lineNotifyEnabled: false,
  });

  return NextResponse.json({
    ok: true,
    status: "created",
    tenantId: TENANT_ID,
    embedKey,
    amplifyHint: `PLATFORM_GLOBAL_CHAT_TENANT_ID=${TENANT_ID}`,
  });
}
