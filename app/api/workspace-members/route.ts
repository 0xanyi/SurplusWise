import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as workspaceMembers from "@/lib/db/workspace-members";

function apiError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }
  if (error instanceof Error && (error.message.includes("already") || error.message.includes("not found"))) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("owner");
    return NextResponse.json(await workspaceMembers.list(actorUserId, workspaceId));
  } catch (error) {
    return apiError(error, "Failed to load workspace members");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("owner");
    const body = await request.json();
    const { invitation, token } = await workspaceMembers.createInvitation(
      actorUserId,
      workspaceId,
      { email: body.email, role: body.role },
    );
    const baseUrl = process.env.PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const inviteUrl = new URL("/auth/signup", baseUrl);
    inviteUrl.searchParams.set("invite", token);
    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
        inviteUrl: inviteUrl.href,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, "Failed to create workspace invitation");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("owner");
    const body = await request.json();
    await workspaceMembers.updateRole(actorUserId, workspaceId, body.userId, body.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Failed to update workspace member");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("owner");
    const body = await request.json();
    if (body.invitationId) {
      await workspaceMembers.revokeInvitation(actorUserId, workspaceId, body.invitationId);
    } else {
      await workspaceMembers.removeMember(actorUserId, workspaceId, body.userId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Failed to remove workspace access");
  }
}
