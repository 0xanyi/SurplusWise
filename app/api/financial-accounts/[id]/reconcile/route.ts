import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as accountService from "@/lib/db/financial-accounts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const result = await accountService.reconcile(workspaceId, id, {
      statementDate: body.statementDate ?? body.statement_date,
      statementBalance: body.statementBalance ?? body.statement_balance,
    });
    return NextResponse.json(
      result.reconciled
        ? result
        : {
            ...result,
            error: `The ledger differs from the statement by ${result.difference.toFixed(2)}`,
          },
      { status: result.reconciled ? 200 : 409 },
    );
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
    const message = error instanceof Error ? error.message : "Failed to reconcile account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
