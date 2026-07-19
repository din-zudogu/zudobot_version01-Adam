/**
 * Seed the ACTIVE DATA_PROCESSING_AGREEMENT (PDPA) document for the zudobot
 * onboarding PDPA consent modal. Safe to re-run — skips if an ACTIVE doc
 * already exists.
 *
 * Run: node scripts/seed-legal-documents.mjs
 *  (from apps/web directory — reads MONGO_URI from .env.local directly,
 *  bypassing `node --env-file` since passwords containing "$" break its parser)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

function getEnvVar(name) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.replace(/\r$/, "").trim();
    if (trimmed.startsWith(name + "=")) {
      return trimmed.slice(name.length + 1).replace(/\r$/, "");
    }
  }
  return null;
}

const RAW_URI = getEnvVar("MONGO_URI_DIRECT") ?? getEnvVar("MONGO_URI") ?? process.env.MONGO_URI;
if (!RAW_URI) {
  console.error("MONGO_URI not found in .env.local or process.env.");
  process.exit(1);
}

// Split credentials from host (password may contain special chars like "$" or "@")
// so we can pass them to mongoose.connect() as explicit options instead of
// relying on URI parsing, matching scripts/run-cleanup.mjs's approach.
const schemeMatch = RAW_URI.match(/^(mongodb(?:\+srv)?:\/\/)/);
if (!schemeMatch) {
  console.error("Invalid MONGO_URI scheme.");
  process.exit(1);
}
const scheme = schemeMatch[1];
const rest = RAW_URI.slice(scheme.length);
const lastAt = rest.lastIndexOf("@");
const credsPart = rest.slice(0, lastAt);
const hostPart = rest.slice(lastAt + 1);
const firstColon = credsPart.indexOf(":");
const mongoUser = credsPart.slice(0, firstColon);
const mongoPass = credsPart.slice(firstColon + 1);
const uriWithoutCreds = `${scheme}${hostPart}`;

const schema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ["DATA_PROCESSING_AGREEMENT", "TENANT_TERMS_OF_SERVICE"], required: true, index: true },
    title: { type: String, required: true },
    version: { type: String, default: "1.0" },
    content: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "DRAFT", "ARCHIVED"], default: "ACTIVE", index: true },
    effectiveAt: { type: Date },
    requiredForFeatures: { type: [String], default: [] },
  },
  { timestamps: true }
);

const LegalDocument = mongoose.models.LegalDocument ?? mongoose.model("LegalDocument", schema);

const PDPA_CONTENT = `
<p><strong>ข้อตกลงการประมวลผลข้อมูลส่วนบุคคล (Data Processing Agreement)</strong></p>
<p><strong>เวอร์ชัน:</strong> 1.0 | <strong>มีผลบังคับใช้:</strong> 1 มกราคม 2568</p>

<h3>1. วัตถุประสงค์การเก็บรวบรวมข้อมูล</h3>
<p>ZUDOBOT เก็บรวบรวมข้อมูลส่วนบุคคลของท่านเพื่อวัตถุประสงค์ดังต่อไปนี้</p>
<ul>
  <li>การสร้างและบริหารจัดการบัญชีผู้ใช้งาน (Tenant) บนแพลตฟอร์ม ZUDOBOT</li>
  <li>การให้บริการแชทบอท AI สำหรับธุรกิจของท่าน รวมถึง Widget</li>
  <li>การยืนยันตัวตนผ่าน Google Sign-In และการป้องกันการทุจริต</li>
  <li>การส่งข้อมูลข่าวสาร การแจ้งเตือนการใช้งาน และการสนับสนุนด้านเทคนิค</li>
  <li>การปฏิบัติตามกฎหมายและระเบียบข้อบังคับที่เกี่ยวข้อง</li>
</ul>

<h3>2. ข้อมูลที่เราเก็บรวบรวม</h3>
<p>เราเก็บรวบรวมข้อมูลดังต่อไปนี้</p>
<ul>
  <li>ชื่อ อีเมล และรูปโปรไฟล์จากบัญชี Google ของท่าน</li>
  <li>ข้อมูลธุรกิจ (ชื่อองค์กร, ประเภทธุรกิจ, วัตถุประสงค์การใช้งาน)</li>
  <li>ข้อมูลการตั้งค่าบอทและ Widget (ชื่อบอท, ข้อความต้อนรับ, สีและตำแหน่ง)</li>
  <li>ข้อมูลการใช้งานระบบ (ประวัติการสนทนาผ่าน Widget, จำนวนข้อความ, Log การเข้าใช้งาน)</li>
</ul>

<h3>3. การเปิดเผยข้อมูลแก่บุคคลที่สาม</h3>
<p>เราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอก ยกเว้นในกรณีดังต่อไปนี้</p>
<ul>
  <li>ได้รับความยินยอมจากท่านอย่างชัดแจ้ง</li>
  <li>มีความจำเป็นเพื่อการให้บริการ (เช่น ผู้ให้บริการ AI, ผู้ให้บริการ Cloud)</li>
  <li>เป็นไปตามที่กฎหมายกำหนดหรือมีคำสั่งจากหน่วยงานที่มีอำนาจ</li>
</ul>

<h3>4. ระยะเวลาการเก็บรักษาข้อมูล</h3>
<p>เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านตลอดระยะเวลาที่ท่านมีบัญชีบนแพลตฟอร์ม ZUDOBOT และอีกเป็นระยะเวลา 90 วันหลังจากที่บัญชีถูกลบ เพื่อวัตถุประสงค์ทางกฎหมายและการตรวจสอบ</p>

<h3>5. สิทธิของเจ้าของข้อมูล</h3>
<p>ท่านมีสิทธิดังต่อไปนี้ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
<ul>
  <li>สิทธิในการเข้าถึงและขอสำเนาข้อมูลส่วนบุคคล</li>
  <li>สิทธิในการขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
  <li>สิทธิในการขอลบหรือทำลายข้อมูล (ในบางกรณี)</li>
  <li>สิทธิในการขอระงับการใช้ข้อมูล</li>
  <li>สิทธิในการถอนความยินยอม (ซึ่งอาจส่งผลต่อการให้บริการ)</li>
</ul>

<h3>6. การรักษาความปลอดภัยของข้อมูล</h3>
<p>เรานำมาตรการรักษาความปลอดภัยที่เหมาะสมมาใช้ ทั้งทางด้านเทคนิคและองค์กร เพื่อปกป้องข้อมูลส่วนบุคคลของท่านจากการเข้าถึง การเปลี่ยนแปลง การเปิดเผย หรือการทำลายโดยไม่ได้รับอนุญาต</p>

<h3>7. ช่องทางติดต่อ</h3>
<p>หากท่านมีคำถามหรือต้องการใช้สิทธิตาม PDPA กรุณาติดต่อ: <strong>privacy@zudogu.com</strong></p>

<p style="margin-top: 16px; color: #475569;">การยินยอมนี้ถือเป็นส่วนหนึ่งของข้อตกลงการใช้งาน ZUDOBOT และมีผลบังคับใช้นับตั้งแต่วันที่ท่านยืนยันยอมรับ</p>
`.trim();

async function main() {
  await mongoose.connect(uriWithoutCreds, {
    dbName: "zudobot_saas",
    user: mongoUser,
    pass: mongoPass,
    authSource: "admin",
  });
  console.log("Connected to MongoDB\n");

  const existing = await LegalDocument.findOne({ documentType: "DATA_PROCESSING_AGREEMENT", status: "ACTIVE" });
  if (existing) {
    console.log("ACTIVE DATA_PROCESSING_AGREEMENT already exists — skipping.");
  } else {
    const doc = await LegalDocument.create({
      documentType: "DATA_PROCESSING_AGREEMENT",
      title: "ข้อตกลงการประมวลผลข้อมูลส่วนบุคคล (PDPA Consent) — ZUDOBOT v1.0",
      version: "1.0",
      content: PDPA_CONTENT,
      status: "ACTIVE",
      requiredForFeatures: ["ONBOARDING"],
    });
    console.log(`Inserted ACTIVE DATA_PROCESSING_AGREEMENT -> _id: ${doc._id}`);
  }

  await mongoose.disconnect();
  console.log("Disconnected");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
