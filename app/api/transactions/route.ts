import { isAuthenticated, fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

const toTransaction = (transaction: any) => ({
  id: transaction._id,
  amount: transaction.amount,
  date: transaction.date,
  type: transaction.type,
  category: transaction.category,
  notes: transaction.notes ?? null,
  receipt_url: transaction.receiptStorageId ?? null,
  created_at: transaction.createdAt
    ? new Date(transaction.createdAt).toISOString()
    : null,
});

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "expense" | "giving" | null;
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    const transactions = await fetchAuthQuery(api.transactions.list, {
      type: type || undefined,
      category: category || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
    });

    return NextResponse.json({
      transactions: transactions.map(toTransaction),
    });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const id = await fetchAuthMutation(api.transactions.create, {
      amount: body.amount,
      date: body.date,
      type: body.type,
      category: body.category,
      notes: body.notes,
      receiptStorageId: body.receiptStorageId ?? body.receipt_url,
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
