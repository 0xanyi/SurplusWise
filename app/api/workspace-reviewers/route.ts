import { NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { listReviewers } from "@/lib/db/workspace-members";

export async function GET() {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    return NextResponse.json({ reviewers: await listReviewers(workspaceId) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to list workspace reviewers:", error);
    return NextResponse.json({ error: "Failed to list workspace reviewers" }, { status: 500 });
  }
}
