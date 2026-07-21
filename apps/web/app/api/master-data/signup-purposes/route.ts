import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getPostgresDb } from "@/lib/db/postgres";
import { signupPurposes } from "@/lib/db/pg/schema";
import { ensureMasterData } from "@/lib/db/pg/ensureMasterData";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await ensureMasterData();
  } catch (err) {
    console.error("[master-data/signup-purposes] ensureMasterData failed:", err);
    return NextResponse.json(
      { error: "master_data_unavailable", details: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }

  const db = getPostgresDb();
  const rows = await db
    .select({
      id: signupPurposes.id,
      code: signupPurposes.code,
      nameTh: signupPurposes.nameTh,
      sortOrder: signupPurposes.sortOrder,
    })
    .from(signupPurposes)
    .where(eq(signupPurposes.isActive, true))
    .orderBy(asc(signupPurposes.sortOrder));

  return NextResponse.json({ items: rows }, { status: 200 });
}
