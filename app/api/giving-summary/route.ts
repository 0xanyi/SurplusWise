import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getAnnualSummary } from "@/lib/db/giving-summary";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const rawYear = request.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear());
    if (!/^\d{4}$/.test(rawYear) || Number(rawYear) < 1900) {
      return NextResponse.json(
        { error: "Year must be a whole number between 1900 and 9999" },
        { status: 400 },
      );
    }
    const summary = await getAnnualSummary(userId, workspaceId, Number(rawYear));
    return NextResponse.json({
      year: summary.year,
      gift_count: summary.giftCount,
      amount: summary.amount,
      recipients: summary.recipients.map((recipient) => ({
        recipient_id: recipient.recipientId,
        recipient_name: recipient.recipientName,
        gift_count: recipient.giftCount,
        amount: recipient.amount,
        designations: recipient.designations.map((designation) => ({
          designation_id: designation.designationId,
          designation_name: designation.designationName,
          gift_count: designation.giftCount,
          amount: designation.amount,
        })),
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch annual giving summary");
  }
}
