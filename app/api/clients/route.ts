import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as clientsService from "@/lib/db/clients";
import { errorResponse } from "@/lib/api-errors";
import { sumRollups } from "@/lib/rebill";
import { NextRequest, NextResponse } from "next/server";

export function toClient(row: clientsService.ClientWithRollup) {
  return {
    id: row.id,
    name: row.name,
    contact_email: row.contactEmail,
    notes: row.notes,
    is_active: row.isActive,
    service_count: row.serviceCount,
    monthly_fronted: row.monthlyFronted,
    fronted: row.fronted,
    received: row.received,
    expected_recovery: row.expectedRecovery,
    not_yet_recovered: row.notYetRecovered,
    margin: row.margin,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const activeParam = request.nextUrl.searchParams.get("active");
    const isActive = activeParam === null ? undefined : activeParam === "true";

    const rows = await clientsService.listWithRollups(userId, workspaceId, isActive);
    // Summed from the same rollups the rows show, so a stat tile can never
    // disagree with the list beneath it.
    const totals = sumRollups(rows);

    return NextResponse.json({
      clients: rows.map(toClient),
      totals: {
        fronted: totals.fronted,
        received: totals.received,
        not_yet_recovered: totals.notYetRecovered,
        monthly_fronted: totals.monthlyFronted,
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch clients");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await clientsService.create(userId, workspaceId, {
      name: body.name,
      contactEmail: "contactEmail" in body ? body.contactEmail : body.contact_email,
      notes: body.notes,
    });

    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to create client",
      "A client with that name already exists in this workspace",
    );
  }
}
