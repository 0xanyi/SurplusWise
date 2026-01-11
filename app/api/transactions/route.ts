import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch all transactions for the current user with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get("type"); // 'expense' or 'giving'
    const type = (typeParam === "expense" || typeParam === "giving") ? typeParam : null;
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id);

    // Apply filters
    if (type) {
      query = query.eq("type", type);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (startDate) {
      query = query.gte("date", startDate);
    }

    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (search) {
      query = query.or(`notes.ilike.%${search}%,category.ilike.%${search}%`);
    }

    // Order by date descending (newest first)
    query = query.order("date", { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, date, type, category, notes, receipt_url } = body;

    // Validation
    if (!amount || !date || !type || !category) {
      return NextResponse.json(
        { error: "Amount, date, type, and category are required" },
        { status: 400 }
      );
    }

    if (type !== "expense" && type !== "giving") {
      return NextResponse.json(
        { error: "Type must be either 'expense' or 'giving'" },
        { status: 400 }
      );
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: parseFloat(amount),
        date,
        type,
        category,
        notes: notes || null,
        receipt_url: receipt_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
