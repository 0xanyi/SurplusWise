import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as documentsService from "@/lib/db/transaction-documents";

const PAGE_SIZE = 10;

function currentYearRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const defaults = currentYearRange();
    const startDate = request.nextUrl.searchParams.get("startDate") ?? defaults.startDate;
    const endDate = request.nextUrl.searchParams.get("endDate") ?? defaults.endDate;
    const rawPage = request.nextUrl.searchParams.get("page") ?? "0";
    if (!/^\d+$/.test(rawPage) || Number(rawPage) > 1000) {
      return NextResponse.json(
        { error: "Page must be a non-negative integer no greater than 1000" },
        { status: 400 },
      );
    }
    const result = await documentsService.listMissingForGiving(
      userId,
      workspaceId,
      startDate,
      endDate,
      Number(rawPage),
      PAGE_SIZE,
    );
    return NextResponse.json({
      period_start: startDate,
      period_end: endDate,
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
      has_more: result.hasMore,
      transactions: result.rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        date: row.date,
        category: row.category,
        payee: row.payee,
        giving_recipient_name: row.givingRecipientName,
        giving_designation_name: row.givingDesignationName,
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch missing supporting documents");
  }
}
