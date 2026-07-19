import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";

export interface PublicCustomizeScenario {
  id:                  string;
  label:               string;
  calculationType:     "ai_base" | "storage" | "expired";
  plan:                string;
  bestPriceZudobot:    number;
  isTrialPackage:      boolean;
  isBestPriceHighlight: boolean;
  sortOrder:           number;
  // Spec fields — shown to customer so they know what they're buying
  messageCount?:       number;   // AI Base: messages per period
  aiBaseMonths?:       number;   // AI Base: subscription months
  storageMbPerMonth?:  number;   // Storage: MB per month
  storageExpireDays?:  number;   // Memory Expired: retention days
  packageDescription?: string;
}

export interface CustomizeScenariosResponse {
  ok:        boolean;
  ai_base:   PublicCustomizeScenario[];
  storage:   PublicCustomizeScenario[];
  expired:   PublicCustomizeScenario[];
}

export async function GET() {
  try {
    await connectDB();

    // isOnSale: { $ne: false } — matches true OR undefined (items created before field existed)
    // This mirrors the admin display rule: show when isOnSale !== false
    const docs = await CostPriceScenarioModel.find(
      { isActive: true, isOnSale: { $ne: false } },
      {
        label: 1,
        inputs: 1,
        isTrialPackage: 1,
        isBestPriceHighlight: 1,
        sortOrder: 1,
        packageDescription: 1,
      },
    )
      .lean();

    const grouped: CustomizeScenariosResponse = {
      ok:      true,
      ai_base: [],
      storage: [],
      expired: [],
    };

    for (const doc of docs) {
      // inputs is stored as a mixed schema — cast to access all fields
      const inputs = doc.inputs as unknown as Record<string, unknown>;
      const type = inputs?.calculationType as "ai_base" | "storage" | "expired" | undefined;

      // Skip if no valid calculationType
      if (!type || !(type in grouped)) continue;

      const entry: PublicCustomizeScenario = {
        id:               (doc._id as { toString(): string }).toString(),
        label:            doc.label,
        calculationType:  type,
        plan:             (inputs?.plan as string) ?? "",
        bestPriceZudobot: (inputs?.bestPriceZudobot as number) ?? 0,
        isTrialPackage:   doc.isTrialPackage ?? false,
        isBestPriceHighlight: doc.isBestPriceHighlight ?? false,
        sortOrder:        doc.sortOrder ?? 0,
        packageDescription: doc.packageDescription,
        // Spec details
        messageCount:      (inputs?.messageCount as number) || undefined,
        aiBaseMonths:      (inputs?.aiBaseMonths as number) || undefined,
        storageMbPerMonth: (inputs?.storageMbPerMonth as number) || undefined,
        storageExpireDays: (inputs?.storageExpireDays as number) || undefined,
      };

      (grouped[type] as PublicCustomizeScenario[]).push(entry);
    }

    return NextResponse.json(grouped, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[customize-scenarios]", err);
    return NextResponse.json({ ok: false, ai_base: [], storage: [], expired: [] }, { status: 500 });
  }
}
