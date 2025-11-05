import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// PUT - Update a category
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const params = await context.params;
    const { id } = params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, icon } = body;

    // Check if category belongs to user
    const { data: existingCategory } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Prevent editing default categories' names
    const updateData: any = {};
    if (name && !existingCategory.is_default) {
      updateData.name = name;
    }
    if (color) {
      updateData.color = color;
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }

    const { data: category, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating category:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a category
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const params = await context.params;
    const { id } = params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if category belongs to user and is not a default category
    const { data: category } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (category.is_default) {
      return NextResponse.json(
        { error: "Cannot delete default categories" },
        { status: 400 }
      );
    }

    // Check if category is being used in any transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", category.name)
      .limit(1);

    if (transactions && transactions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with existing transactions" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
