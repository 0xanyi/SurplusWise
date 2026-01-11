import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch all budgets for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const typeParam = searchParams.get('type');

    type BudgetPeriod = "monthly" | "quarterly" | "yearly";
    type BudgetType = "expense" | "giving";

    const period = (periodParam === "monthly" || periodParam === "quarterly" || periodParam === "yearly")
      ? periodParam
      : null;
    const type = (typeParam === "expense" || typeParam === "giving")
      ? typeParam
      : null;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (period) {
      query = query.eq("period", period);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data: budgets, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching budgets:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const { data: transactions } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", user.id)
          .eq("category", budget.category)
          .eq("type", budget.type)
          .gte("date", budget.start_date)
          .lte("date", budget.end_date);

        const spent = transactions?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
          ...budget,
          spent,
          remaining,
          percentage: Math.min(percentage, 100),
          status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : 'ok'
        };
      })
    );

    return NextResponse.json({ budgets: budgetsWithSpending });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new budget
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { category, amount, period, start_date, end_date, type } = body;

    if (!category || !amount || !period || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if budget already exists for this category and period
    const { data: existing } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", category)
      .eq("period", period)
      .eq("start_date", start_date)
      .eq("type", type || 'expense')
      .eq("is_active", true)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Budget already exists for this category and period" },
        { status: 400 }
      );
    }

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        category,
        amount: parseFloat(amount),
        period,
        start_date,
        end_date,
        type: type || 'expense',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating budget:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
