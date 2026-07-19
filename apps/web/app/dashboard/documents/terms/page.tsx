"use client";

import { LegalDocumentBody } from "@/components/legal/LegalDocumentModal";

export default function TermsDocumentPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Terms and Conditions</h1>
        <p className="text-sm text-text-muted mt-0.5">ข้อกำหนดและเงื่อนไขการใช้บริการ — ลูกค้าต้องยอมรับก่อนยืนยันคำสั่งซื้อ</p>
      </div>
      <div className="bg-white border border-border-default rounded-2xl p-6 shadow-sm">
        <LegalDocumentBody documentType="TENANT_TERMS_OF_SERVICE" />
      </div>
    </div>
  );
}
