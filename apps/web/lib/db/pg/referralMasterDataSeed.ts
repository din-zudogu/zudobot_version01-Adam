// Default seed data for the "บอกต่อ" (Recommend) referral & points program —
// transcribed from the spec's point rules (items 5.1-5.8, 6, 7) and reward
// tiers (item 4). packageId values are free-text placeholders since none of
// these plan names exist in code (they're admin-authored PackageConfig /
// Stripe data) — admins repoint them at real catalog IDs via the admin UI.

export interface PointsRuleSeed {
  eventType: "referral" | "plan_signup" | "plan_renewal" | "addon_purchase" | "addon_renewal";
  packageId: string | null;
  points: number;
  label: string;
}

export const POINTS_RULES: PointsRuleSeed[] = [
  { eventType: "referral", packageId: null, points: 50, label: "แนะนำเพื่อนสำเร็จ (บอกต่อ + เพื่อนติดตั้งสำเร็จ)" },

  { eventType: "plan_signup", packageId: "begin_starter_package", points: 50, label: "สมัครใช้งานรายเดือน Begin/Starter Package" },

  { eventType: "plan_signup", packageId: "mini_start_monthly", points: 30, label: "สมัครใช้งานรายเดือน MINI START (MONTHLY)" },
  { eventType: "plan_renewal", packageId: "mini_start_monthly", points: 30, label: "Renew รายเดือน MINI START (MONTHLY) ต่อเนื่อง" },

  { eventType: "plan_signup", packageId: "zudobot_begin_monthly", points: 50, label: "สมัครใช้งานรายเดือน ZUDOBOT - BEGIN (MONTHLY)" },
  { eventType: "plan_renewal", packageId: "zudobot_begin_monthly", points: 70, label: "Renew รายเดือน ZUDOBOT - BEGIN (MONTHLY) ต่อเนื่อง" },

  { eventType: "plan_signup", packageId: "zudobot_pro_monthly", points: 70, label: "สมัครใช้งานรายเดือน ZUDOBOT - PRO (MONTHLY)" },
  { eventType: "plan_renewal", packageId: "zudobot_pro_monthly", points: 100, label: "Renew รายเดือน ZUDOBOT - PRO (MONTHLY) ต่อเนื่อง" },

  { eventType: "addon_purchase", packageId: "addon_mini", points: 10, label: "ซื้อบริการเพิ่มเติม ระดับ MINI" },
  { eventType: "addon_purchase", packageId: "addon_starter", points: 30, label: "ซื้อบริการเพิ่มเติม ระดับ STARTER" },
  { eventType: "addon_purchase", packageId: "addon_pro", points: 50, label: "ซื้อบริการเพิ่มเติม ระดับ PRO" },
  { eventType: "addon_purchase", packageId: "addon_master", points: 100, label: "ซื้อบริการเพิ่มเติม ระดับ MASTER" },

  { eventType: "addon_renewal", packageId: "addon_mini", points: 20, label: "Renew บริการเพิ่มเติม ระดับ MINI ต่อเนื่อง" },
  { eventType: "addon_renewal", packageId: "addon_starter", points: 50, label: "Renew บริการเพิ่มเติม ระดับ STARTER ต่อเนื่อง" },
  { eventType: "addon_renewal", packageId: "addon_pro", points: 70, label: "Renew บริการเพิ่มเติม ระดับ PRO ต่อเนื่อง" },
  { eventType: "addon_renewal", packageId: "addon_master", points: 120, label: "Renew บริการเพิ่มเติม ระดับ MASTER ต่อเนื่อง" },
];

export interface RewardTierSeed {
  minPoints: number;
  maxPoints: number | null;
  costPoints: number;
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
  label: string;
  sortOrder: number;
}

export const REWARD_TIERS: RewardTierSeed[] = [
  { minPoints: 51, maxPoints: 100, costPoints: 51, bonusMsgPerMonth: 10, bonusRetentionDays: 0, bonusMemoryMb: 0, label: "AI Token คุยได้เพิ่มอีก 10 ประโยค", sortOrder: 10 },
  { minPoints: 101, maxPoints: 250, costPoints: 101, bonusMsgPerMonth: 20, bonusRetentionDays: 0, bonusMemoryMb: 0, label: "AI Token คุยได้เพิ่มอีก 20 ประโยค", sortOrder: 20 },
  { minPoints: 251, maxPoints: 500, costPoints: 251, bonusMsgPerMonth: 20, bonusRetentionDays: 7, bonusMemoryMb: 0, label: "AI Token +20 ประโยค และระยะเวลาจดจำบทสนทนา +7 วัน", sortOrder: 30 },
  { minPoints: 501, maxPoints: 700, costPoints: 501, bonusMsgPerMonth: 30, bonusRetentionDays: 14, bonusMemoryMb: 0, label: "AI Token +30 ประโยค และระยะเวลาจดจำบทสนทนา +14 วัน", sortOrder: 40 },
  { minPoints: 701, maxPoints: 1000, costPoints: 701, bonusMsgPerMonth: 30, bonusRetentionDays: 30, bonusMemoryMb: 4, label: "AI Token +30 ประโยค, จดจำบทสนทนา +30 วัน, หน่วยความจำ +4MB", sortOrder: 50 },
];
