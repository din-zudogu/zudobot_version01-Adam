"use client";

import { LegalDocumentBody } from "@/components/legal/LegalDocumentModal";

export default function PdpaDocumentPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-text-primary">PDPA / GDPR</h1>
        <p className="text-sm text-text-muted mt-0.5">ข้อตกลงการประมวลผลข้อมูลส่วนบุคคล — ลูกค้าต้องให้ความยินยอมก่อนยืนยันคำสั่งซื้อ</p>
      </div>
      <div className="bg-white border border-border-default rounded-2xl p-6 shadow-sm">
        <LegalDocumentBody documentType="DATA_PROCESSING_AGREEMENT" />
      </div>
    </div>
  );
}
