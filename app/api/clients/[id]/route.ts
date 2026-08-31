import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as clientsService from "@/lib/db/clients";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import * as transactionsService from "@/lib/db/transactions";
import { errorResponse } from "@/lib/api-errors";
import { expectsRecovery, isPassThrough, type RebillMode } from "@/lib/rebill";
import { NextRequest, NextResponse } from "next/server";
import { toClient } from "../route";

const DUPLICATE_NAME = "A client with that name already exists in this workspace";

/** How many attributed transactions the detail page renders. */
const ACTIVITY_LIMIT = 50;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const client = await clientsService.getWithRollup(workspaceId, id);
    const outgoings = await outgoingsService.list(workspaceId, undefined, "expense");
    const activity = await transactionsService.list(workspaceId, { clientId: id });

    const services = outgoings
      .filter((row) => row.clientId === id)
      .map((row) => {
        const mode = row.rebillMode as RebillMode;
        return {
          id: row.id,
          name: row.name,
          amount: Number(row.amount),
          day_of_month: row.dayOfMonth,
          frequency: row.frequency,
          category: row.category,
          vendor: row.vendor,
          rebill_mode: mode,
          rebill_amount: row.rebillAmount === null ? null : Number(row.rebillAmount),
          /** What one cycle is expected to bring back; null when nothing is. */
          expected_per_cycle: expectsRecovery(mode)
            ? mode === "fixed"
              ? Number(row.rebillAmount ?? 0)
              : Number(row.amount)
            : null,
          is_pass_through: isPassThrough(mode),
          is_active: row.isActive,
        };
      });

    return NextResponse.json({
      client: toClient(client),
      services,
      // The rollup figures above come from the full set; only the visible list
      // is capped, and the count below lets the page say so rather than
      // silently showing a partial history.
      activity: activity.slice(0, ACTIVITY_LIMIT).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        date: row.date,
        type: row.type,
        category: row.category,
        notes: row.notes,
      })),
      activity_total: activity.length,
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch client");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    // Presence, not truthiness: `null` is how the client clears a field, and
    // `??` would read that as "absent" and silently drop the edit.
    const pick = (camel: string, snake: string) =>
      camel in body ? body[camel] : snake in body ? body[snake] : undefined;

    const contactEmail = pick("contactEmail", "contact_email");
    const isActive = pick("isActive", "is_active");

    await clientsService.update(workspaceId, id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(isActive !== undefined && { isActive }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to update client", DUPLICATE_NAME);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;

    await clientsService.remove(workspaceId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete client");
  }
}
