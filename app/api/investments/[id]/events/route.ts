import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as investmentsService from "@/lib/db/investments";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    investment_id: row.investmentId,
    event_type: row.eventType,
    amount: Number(row.amount),
    event_date: row.eventDate,
    notes: row.notes,
    created_at: row.createdAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const events = await investmentsService.listEvents(workspaceId, id);

    return NextResponse.json({ events: events.map(toEvent) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to fetch investment events:", error);
    return NextResponse.json(
      { error: "Failed to fetch investment events" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const event = await investmentsService.addEvent(workspaceId, id, {
      eventType: body.eventType ?? body.event_type,
      amount: body.amount,
      eventDate: body.eventDate ?? body.event_date,
      notes: body.notes,
    });

    return NextResponse.json({ id: event.id });
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
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to create investment event:", error);
    return NextResponse.json(
      { error: "Failed to create investment event" },
      { status: 500 },
    );
  }
}
