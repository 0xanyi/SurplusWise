import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as profileService from "@/lib/db/transaction-import-profiles";

function toProfile(row: Awaited<ReturnType<typeof profileService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    account_id: row.financialAccountId,
    mapping: row.mapping,
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const accountId = request.nextUrl.searchParams.get("accountId") ?? undefined;
    const profiles = await profileService.list(userId, workspaceId, accountId);
    return NextResponse.json({ profiles: profiles.map(toProfile) });
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
    const message = error instanceof Error ? error.message : "Failed to list import profiles";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await profileService.save(userId, workspaceId, {
      name: body.name,
      accountId: body.accountId ?? body.account_id,
      mapping: body.mapping,
    });
    return NextResponse.json({ profile: toProfile(row) }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to save import profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
