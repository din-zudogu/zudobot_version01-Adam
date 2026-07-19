// วางใน MongoDB Compass → CLTZUDOBOT → zudobot_saas → แท็บ "_MONGOSH" แล้วกด Run
// (หรือเปิด MongoSH ที่เชื่อม cluster นี้อยู่แล้ว)

const TENANT_ID = "6a131c821296d01b12412734";
const MOCK_EMAIL = "mock-universal-embed@zudobot.internal";
const EMBED_KEY = "a7f3c9e21b584d0e96f2a1c8d4e5b7f0";
const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const dbSaas = db.getSiblingDB("zudobot_saas");

const existingProfile = dbSaas.tenantprofiles.findOne({ tenantId: TENANT_ID });
if (existingProfile) {
  print("⚠️  tenantprofiles มีอยู่แล้ว");
  printjson({ tenantId: existingProfile.tenantId, embedKey: existingProfile.embedKey });
  print("\n👉 PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);
  quit(0);
}

const userOid = ObjectId(TENANT_ID);
if (!dbSaas.users.findOne({ _id: userOid })) {
  dbSaas.users.insertOne({
    _id: userOid,
    email: MOCK_EMAIL,
    name: "Mock Universal Embed Tenant",
    role: "tenant",
    roles: ["tenant"],
    tenantId: TENANT_ID,
    botState: "active",
    onboardingComplete: true,
    twoFactorEnabled: false,
    twoFactorVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  print("✅  Inserted users");
} else {
  print("ℹ️  users มีอยู่แล้ว — ข้าม");
}

const profileResult = dbSaas.tenantprofiles.insertOne({
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
  quotaAlert80Sent: false,
  quotaAlert95Sent: false,
  monthlyMessageCount: 0,
  monthlyMessageResetAt: monthStart,
  embedKey: EMBED_KEY,
  trialStartedAt: now,
  lineEnabled: false,
  lineNotifyEnabled: false,
  dailyMessageCount: 0,
  dailyMessageResetAt: now,
  totalMessageCount: 0,
  createdAt: now,
  updatedAt: now,
});

print("✅  Inserted tenantprofiles");
printjson(profileResult);
print("\n👉 AWS Amplify:");
print("PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);
print("embedKey (internal): " + EMBED_KEY);
