import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";
import { toOccurrence } from "../serialize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const expectedAmount = Object.hasOwn(body, "expectedAmount")
      ? body.expectedAmount
      : body.expected_amount;
    const occurrence = await recurringMoneyOccurrences.revise(workspaceId, {
      occurrenceId: id,
      expectedAmount,
    });
    return NextResponse.json(toOccurrence(occurrence));
  } catch (error) {
    return errorResponse(error, "Failed to revise Recurring money occurrence");
  }
}
