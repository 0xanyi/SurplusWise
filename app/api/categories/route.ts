import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_GIVING_CATEGORIES } from "@/lib/categories";

// GET - Fetch all categories for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If user has no categories, seed default ones
    if (!categories || categories.length === 0) {
      const defaultCategories = [
        ...DEFAULT_EXPENSE_CATEGORIES.map(cat => ({
          user_id: user.id,
          name: cat.name,
          type: 'expense' as const,
          color: cat.color,
          icon: cat.icon,
          is_default: true,
        })),
        ...DEFAULT_GIVING_CATEGORIES.map(cat => ({
          user_id: user.id,
          name: cat.name,
          type: 'giving' as const,
          color: cat.color,
          icon: cat.icon,
          is_default: true,
        }))
      ];

      const { data: seededCategories, error: seedError } = await supabase
        .from("categories")
        .insert(defaultCategories)
        .select();

      if (seedError) {
        console.error("Error seeding categories:", seedError);
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      return NextResponse.json({ categories: seededCategories });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new category
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, color, icon } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const { data: category, error } = await supabase
      .from("categories")
      .insert({
        user_id: user.id,
        name,
        type,
        color: color || '#3b82f6',
        icon: icon || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
