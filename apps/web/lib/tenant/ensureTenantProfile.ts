import crypto from "crypto";
import { TenantProfileModel, type ITenantProfile } from "@/lib/db/models/TenantProfile";
import { UserModel } from "@/lib/db/models/User";

export async function ensureTenantProfileForUser(
  tenantId: string
): Promise<ITenantProfile> {
  const existing = await TenantProfileModel.findOne({ tenantId });
  if (existing) return existing;

  const user = await UserModel.findById(tenantId).select("name email").lean();
  const businessName = user?.name?.trim() || user?.email?.trim() || "My Store";

  const embedKey = crypto.randomBytes(16).toString("hex");
  return TenantProfileModel.create({
    tenantId,
    businessName,
    businessType: "ecommerce",
    botName: "Zudobot",
    botGender: "female",
    botTone: "friendly",
    welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
    widgetColor: "#1E5BC6",
    widgetPosition: "bottom-right",
    widgetEnabled: false,
    allowedDomain: "",
    allowedDomains: [],
    embedKey,
    trialStartedAt: new Date(),
  });
}
