import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getPostgresDb } from "@/lib/db/postgres";
import { businessCategories } from "@/lib/db/pg/schema";
import { ensureMasterData } from "@/lib/db/pg/ensureMasterData";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await ensureMasterData();
  } catch (err) {
    console.error("[master-data/business-categories] ensureMasterData failed:", err);
    return NextResponse.json(
      { error: "master_data_unavailable", details: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }

  const db = getPostgresDb();
  const rows = await db
    .select({
      id: businessCategories.id,
      code: businessCategories.code,
      nameTh: businessCategories.nameTh,
      parentId: businessCategories.parentId,
      sortOrder: businessCategories.sortOrder,
    })
    .from(businessCategories)
    .where(eq(businessCategories.isActive, true))
    .orderBy(asc(businessCategories.sortOrder));

  return NextResponse.json({ items: rows }, { status: 200 });
}
