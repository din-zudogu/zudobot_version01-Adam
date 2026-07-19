import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { CostPriceScenarioModel } from "@/lib/db/models/CostPriceScenario";
import {
  csvToExportRows,
  exportRowToScenarioPayload,
  xlsxBufferToExportRows,
} from "@/lib/pricing/costPriceSpreadsheet";

function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const replace = formData.get("replace") === "true";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file_required" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
    const isCsv = name.endsWith(".csv");

    if (!isXlsx && !isCsv) {
      return NextResponse.json(
        { error: "unsupported_format", message: "รองรับเฉพาะ .csv และ .xlsx" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const exportRows = isXlsx
      ? await xlsxBufferToExportRows(buffer)
      : csvToExportRows(buffer.toString("utf-8"));

    if (exportRows.length === 0) {
      return NextResponse.json({ error: "no_rows" }, { status: 400 });
    }

    await connectDB();

    if (replace) {
      await CostPriceScenarioModel.deleteMany({});
    }

    const payloads = exportRows.map((row) => exportRowToScenarioPayload(row));
    const created = await CostPriceScenarioModel.insertMany(
      payloads.map((p) => ({
        label: p.label,
        sortOrder: p.sortOrder,
        isActive: p.isActive,
        inputs: p.inputs,
        calculated: p.calculated,
      })),
    );

    return NextResponse.json({
      ok: true,
      imported: created.length,
      replace,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "import_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
