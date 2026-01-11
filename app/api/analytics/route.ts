import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const period = searchParams.get('period') || 'monthly';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build date filter
    let dateFilter: { gte?: string; lte?: string } = {};

    if (startDate && endDate) {
      // Custom date range
      dateFilter = { gte: startDate, lte: endDate };
    } else {
      // Predefined periods
      const now = new Date();
      let start: Date;

      switch (period) {
        case 'weekly':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'monthly':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarterly':
          const quarter = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'yearly':
          start = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      dateFilter = {
        gte: start.toISOString().split('T')[0],
        lte: now.toISOString().split('T')[0],
      };
    }

    // Fetch all transactions for the period
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", dateFilter.gte!)
      .lte("date", dateFilter.lte!)
      .order("date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
    const transactions = (data ?? []) as Transaction[];

    // Calculate analytics
    const analytics = {
      // Total summaries
      totalExpenses: transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0),
      totalGivings: transactions
        .filter(t => t.type === 'giving')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0),
      transactionCount: transactions.length,

      // Category breakdown for expenses
      expensesByCategory: transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const category = t.category;
          acc[category] = (acc[category] || 0) + parseFloat(t.amount.toString());
          return acc;
        }, {} as Record<string, number>),

      // Category breakdown for givings
      givingsByCategory: transactions
        .filter(t => t.type === 'giving')
        .reduce((acc, t) => {
          const category = t.category;
          acc[category] = (acc[category] || 0) + parseFloat(t.amount.toString());
          return acc;
        }, {} as Record<string, number>),

      // Daily trends
      dailyTrends: transactions.reduce((acc, t) => {
        const date = t.date;
        if (!acc[date]) {
          acc[date] = { date, expenses: 0, givings: 0 };
        }
        if (t.type === 'expense') {
          acc[date].expenses += parseFloat(t.amount.toString());
        } else {
          acc[date].givings += parseFloat(t.amount.toString());
        }
        return acc;
      }, {} as Record<string, { date: string; expenses: number; givings: number }>),

      // Monthly trends (for longer periods)
      monthlyTrends: transactions.reduce((acc, t) => {
        const month = t.date.substring(0, 7); // YYYY-MM
        if (!acc[month]) {
          acc[month] = { month, expenses: 0, givings: 0 };
        }
        if (t.type === 'expense') {
          acc[month].expenses += parseFloat(t.amount.toString());
        } else {
          acc[month].givings += parseFloat(t.amount.toString());
        }
        return acc;
      }, {} as Record<string, { month: string; expenses: number; givings: number }>),
    };

    // Convert objects to arrays for easier charting
    return NextResponse.json({
      ...analytics,
      dailyTrends: Object.values(analytics.dailyTrends),
      monthlyTrends: Object.values(analytics.monthlyTrends),
      expensesByCategoryArray: Object.entries(analytics.expensesByCategory).map(
        ([name, value]) => ({ name, value })
      ),
      givingsByCategoryArray: Object.entries(analytics.givingsByCategory).map(
        ([name, value]) => ({ name, value })
      ),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
