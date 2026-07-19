/**
 * Lazily seeds an ACTIVE DATA_PROCESSING_AGREEMENT document into MongoDB at
 * runtime if none exists yet, so the onboarding PDPA modal never shows
 * "ยังไม่มีเอกสารฉบับใช้งาน" on a fresh environment.
 */
import { connectDB } from "@/lib/db/connect";
import { LegalDocumentModel } from "@/lib/db/models/LegalDocument";
import { ZUDOBOT_PDPA_CONTENT } from "./zudobotPdpaContent";

let ensured = false;
let ensuring: Promise<void> | null = null;

async function doEnsure(): Promise<void> {
  await connectDB();
  const existing = await LegalDocumentModel.findOne({
    documentType: "DATA_PROCESSING_AGREEMENT",
    status: "ACTIVE",
  }).lean();
  if (existing) return;

  await LegalDocumentModel.create({
    documentType: "DATA_PROCESSING_AGREEMENT",
    title: "ข้อตกลงการประมวลผลข้อมูลส่วนบุคคล (PDPA Consent) v1.0",
    version: "1.0",
    content: ZUDOBOT_PDPA_CONTENT,
    status: "ACTIVE",
    requiredForFeatures: ["ONBOARDING"],
  });
}

export async function ensureDefaultPdpaDocument(): Promise<void> {
  if (ensured) return;
  if (!ensuring) {
    ensuring = doEnsure()
      .then(() => {
        ensured = true;
      })
      .finally(() => {
        ensuring = null;
      });
  }
  return ensuring;
}
