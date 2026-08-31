import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { listReviewHistory } from "@/lib/db/transactions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;
    const events = await listReviewHistory(workspaceId, id);
    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        actor_name: event.actorName,
        assigned_to_name: event.assignedToName,
        created_at: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to load transaction review history:", error);
    return NextResponse.json({ error: "Failed to load review history" }, { status: 500 });
  }
}
