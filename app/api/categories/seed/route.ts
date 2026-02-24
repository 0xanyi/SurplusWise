import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import * as categoriesService from "@/lib/db/categories";

export async function POST() {
  try {
    const userId = await requireAuth();
    const result = await categoriesService.ensureDefaults(userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to seed categories:", error);
    return NextResponse.json(
      { error: "Failed to seed categories" },
      { status: 500 },
    );
  }
}
