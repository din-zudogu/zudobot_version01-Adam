/** ฟิลด์ที่ปลอดภัยสำหรับ public/partner — ห้ามเพิ่ม internal cost ที่นี่ */
export type PublicPackageType = "BASE" | "QUOTA_ADDON" | "RETENTION_ADDON";

export interface PublicPackage {
  id: string;
  planCode: string;
  name: string;
  type: PublicPackageType;
  /** รอบบิล เช่น "1m", "6m", "12m" */
  cycle: string;
  msgQuota: number;
  retailPrice: number;
  partnerPrice: number;
  planTier: string;
  sortOrder: number;
}

export interface PublicPricingApiResponse {
  success: boolean;
  data: PublicPackage[];
  message?: string;
}
