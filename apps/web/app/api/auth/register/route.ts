import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Registration via email/password is no longer supported. Please use Google sign-in." },
    { status: 410 }
  );
}
