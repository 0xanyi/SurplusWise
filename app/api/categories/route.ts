import { isAuthenticated, fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

const toCategory = (category: any) => ({
  id: category._id,
  name: category.name,
  type: category.type,
  color: category.color,
  icon: category.icon ?? null,
  is_default: category.isDefault,
  created_at: category.createdAt
    ? new Date(category.createdAt).toISOString()
    : null,
});

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "expense" | "giving" | "income" | null;

    const categories = await fetchAuthQuery(api.categories.list, {
      type: type || undefined,
    });

    return NextResponse.json({
      categories: categories.map(toCategory),
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const id = await fetchAuthMutation(api.categories.create, {
      name: body.name,
      type: body.type,
      color: body.color,
      icon: body.icon,
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
