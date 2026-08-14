import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as onboardingService from "@/lib/db/onboarding";
import { ZodError } from "zod";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("owner");
    const status = await onboardingService.getStatus(userId, workspaceId);
    return NextResponse.json({ completed: status?.hasCompleted ?? false });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch onboarding status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("owner");
    const body = await request.json();

    await onboardingService.complete(userId, workspaceId, {
      currency: body.currency,
      budget: body.budget ?? null,
      transaction: body.transaction ?? null,
    });

    return NextResponse.json({ success: true });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete onboarding" },
      { status: 500 },
    );
  }
}
