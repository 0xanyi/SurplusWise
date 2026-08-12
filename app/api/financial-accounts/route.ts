import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as accountService from "@/lib/db/financial-accounts";

function toAccount(row: Awaited<ReturnType<typeof accountService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    account_class: row.accountClass,
    account_type: row.accountType,
    currency: row.currency,
    opening_balance: Number(row.openingBalance),
    opening_date: row.openingDate,
    current_balance: row.currentBalance,
    projected_balance: row.projectedBalance,
    reconciled_balance: row.reconciledBalance == null ? null : Number(row.reconciledBalance),
    reconciled_at: row.reconciledAt,
    is_active: row.isActive,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const accounts = await accountService.list(userId, workspaceId, includeInactive);
    return NextResponse.json({ accounts: accounts.map(toAccount) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to list financial accounts:", error);
    return NextResponse.json({ error: "Failed to list financial accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await accountService.create(userId, workspaceId, {
      name: body.name,
      accountClass: body.accountClass ?? body.account_class,
      accountType: body.accountType ?? body.account_type,
      currency: body.currency,
      openingBalance: body.openingBalance ?? body.opening_balance,
      openingDate: body.openingDate ?? body.opening_date,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create financial account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
