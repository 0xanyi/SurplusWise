import { NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { getNetWorthSummary } from "@/lib/db/net-worth";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const summary = await getNetWorthSummary(userId, workspaceId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch net worth" }, { status: 500 });
  }
}
