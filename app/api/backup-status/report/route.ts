import { NextRequest, NextResponse } from "next/server";
import { reportBackupSuccess, validBackupReportToken } from "@/lib/backup-status";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!validBackupReportToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await reportBackupSuccess();
    return NextResponse.json({ last_successful_at: status.lastSuccessfulAt.toISOString() });
  } catch (error) {
    console.error("Failed to report backup success:", error);
    return NextResponse.json({ error: "Failed to report backup success" }, { status: 500 });
  }
}
