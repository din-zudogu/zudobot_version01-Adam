import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import mongoose from "mongoose";

export async function GET() {
  const start = Date.now();
  let dbStatus = "unknown";
  let dbMs: number | null = null;
  let dbError: string | null = null;

  try {
    await connectDB();
    // Ping the DB with a lightweight command
    await mongoose.connection.db!.admin().ping();
    dbMs = Date.now() - start;
    dbStatus = "ok";
  } catch (err) {
    dbMs = Date.now() - start;
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: { status: dbStatus, ms: dbMs, error: dbError },
    env: {
      hasMongoUri:   !!process.env.MONGO_URI,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasGoogleAuth: !!process.env.GOOGLE_CLIENT_ID,
      nodeEnv:       process.env.NODE_ENV,
    },
    ts: new Date().toISOString(),
  });
}
