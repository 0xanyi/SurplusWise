import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as investmentsService from "@/lib/db/investments";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toInvestment(row: Record<string, unknown>) {
  const costBasis = Number(row.costBasis);
  const currentValue = Number(row.currentValue);
  const gainLoss = currentValue - costBasis;
  const gainLossPct = costBasis !== 0 ? (gainLoss / costBasis) * 100 : 0;

  return {
    id: row.id,
    name: row.name,
    investment_type: row.investmentType,
    platform: row.platform,
    cost_basis: costBasis,
    current_value: currentValue,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    purchase_date: row.purchaseDate,
    gain_loss: gainLoss,
    gain_loss_pct: gainLossPct,
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function GET() {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const investments = await investmentsService.list(workspaceId);
    const summary = await investmentsService.getSummary(workspaceId);

    return NextResponse.json({
      investments: investments.map(toInvestment),
      total_cost_basis: summary.totalCostBasis,
      total_current_value: summary.totalCurrentValue,
      total_gain_loss: summary.totalGainLoss,
      active_count: summary.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch investments:", error);
    return NextResponse.json(
      { error: "Failed to fetch investments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await investmentsService.create(workspaceId, {
      name: body.name,
      investmentType: body.investmentType ?? body.investment_type,
      platform: body.platform,
      costBasis: body.costBasis ?? body.cost_basis,
      currentValue: body.currentValue ?? body.current_value,
      quantity: body.quantity,
      purchaseDate: body.purchaseDate ?? body.purchase_date,
      notes: body.notes,
    });

    return NextResponse.json({ id: row.id });
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
    console.error("Failed to create investment:", error);
    return NextResponse.json(
      { error: "Failed to create investment" },
      { status: 500 },
    );
  }
}
