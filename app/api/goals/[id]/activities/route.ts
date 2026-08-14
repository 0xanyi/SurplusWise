import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as goalActivitiesService from "@/lib/db/goal-activities";

function toActivity(
  row: Awaited<ReturnType<typeof goalActivitiesService.list>>[number],
) {
  return {
    id: row.id,
    goal_id: row.goalId,
    type: row.type,
    amount: Number(row.amount),
    occurred_on: row.occurredOn,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const activities = await goalActivitiesService.list(userId, workspaceId, id);
    return NextResponse.json({ activities: activities.map(toActivity) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to fetch goal activities:", error);
    return NextResponse.json({ error: "Failed to fetch goal activities" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const activity = await goalActivitiesService.create(userId, workspaceId, id, {
      type: body.type,
      amount: body.amount,
      occurredOn: body.occurredOn ?? body.occurred_on,
      notes: body.notes,
    });
    return NextResponse.json(toActivity(activity), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("cannot exceed") || error.message.includes("inactive goal"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to record goal activity:", error);
    return NextResponse.json({ error: "Failed to record goal activity" }, { status: 500 });
  }
}
