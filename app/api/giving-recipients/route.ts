import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as givingService from "@/lib/db/giving-recipients";

function toRecipient(row: Awaited<ReturnType<typeof givingService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    is_active: row.isActive,
    designations: row.designations.map((designation) => ({
      id: designation.id,
      name: designation.name,
      is_active: designation.isActive,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";
    const rows = await givingService.list(workspaceId, activeOnly);
    return NextResponse.json({ recipients: rows.map(toRecipient) });
  } catch (error) {
    return errorResponse(error, "Failed to fetch giving recipients");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await givingService.createRecipient(workspaceId, body);
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to create giving recipient",
      "A giving recipient with that name already exists in this workspace",
    );
  }
}
