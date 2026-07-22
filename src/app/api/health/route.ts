import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Used by the deploy script and process managers/load balancers to confirm the app is up and can reach the database. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
