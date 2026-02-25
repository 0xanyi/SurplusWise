import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as categoriesService from "@/lib/db/categories";
import { transactionTypeSchema } from "@/lib/db/validation";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/** Map DB row → API response shape (stable contract for frontend). */
function toCategory(row: Awaited<ReturnType<typeof categoriesService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon ?? null,
    is_default: row.isDefault,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();

    const searchParams = request.nextUrl.searchParams;
    const rawType = searchParams.get("type");

    // Validate optional type filter
    const type = rawType
      ? transactionTypeSchema.parse(rawType)
      : undefined;

    const categories = await categoriesService.list(
      userId,
      workspaceId,
      type,
    );

    return NextResponse.json({ categories: categories.map(toCategory) });
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
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await categoriesService.create(userId, workspaceId, {
      name: body.name,
      type: body.type,
      color: body.color,
      icon: body.icon ?? null,
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
    if (
      error instanceof Error &&
      error.message.includes("already exists")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
