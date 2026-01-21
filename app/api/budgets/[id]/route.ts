import { isAuthenticated, fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";
import { Id } from "@/convex/_generated/dataModel";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    await fetchAuthMutation(api.budgets.update, {
      id: id as Id<"budgets">,
      ...body,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update budget:", error);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await fetchAuthMutation(api.budgets.remove, {
      id: id as Id<"budgets">,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
  }
}
