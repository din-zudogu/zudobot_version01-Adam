import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import {
  scenarioToExportRow,
  scenariosToCsv,
  scenariosToXlsxBuffer,
} from "@/lib/pricing/costPriceSpreadsheet";
import {
  isCostDataLocked,
  recordAuthFailure,
  recordExportRequest,
  generateHoneypotScenarios,
} from "@/lib/security/costDataGuard";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    void recordAuthFailure();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Record export attempt — bulk export is the highest-risk operation
  await recordExportRequest();

  // When locked: serve a honeypot export file instead of real data
  if (await isCostDataLocked()) {
    type ExportParam = Parameters<typeof scenarioToExportRow>[0];
    const fakeRows = (generateHoneypotScenarios() as unknown as ExportParam[]).map(scenarioToExportRow);
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase() ?? "csv";
    const stamp  = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const buffer = await scenariosToXlsxBuffer(fakeRows);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="zudobot-cost-price-${stamp}.xlsx"`,
        },
      });
    }
    const csv = scenariosToCsv(fakeRows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zudobot-cost-price-${stamp}.csv"`,
      },
    });
  }

  const format = req.nextUrl.searchParams.get("format")?.toLowerCase() ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  try {
    await connectDB();
    const scenarios = await CostPriceScenarioModel.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    const rows = scenarios.map((s) =>
      scenarioToExportRow({
        label: s.label,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        inputs: s.inputs,
        calculated: s.calculated,
      }),
    );

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csv = scenariosToCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="zudobot-cost-price-${stamp}.csv"`,
        },
      });
    }

    const buffer = await scenariosToXlsxBuffer(rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="zudobot-cost-price-${stamp}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "export_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
