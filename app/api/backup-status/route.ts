import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getBackupStatus } from "@/lib/backup-status";

export async function GET() {
  try {
    await requireAuth();
    const status = await getBackupStatus();
    return NextResponse.json({
      configured: status.configured,
      last_successful_at: status.lastSuccessfulAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load backup status");
  }
}
