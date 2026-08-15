import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  workspaceInvitations,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import {
  idSchema,
  userIdSchema,
  workspaceIdSchema,
  workspaceInvitationCreateSchema,
  workspaceMemberRoleSchema,
} from "./validation";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireOwner(userId: string, workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  if (!workspace) throw new Error("Workspace not found or unauthorized");
}

export async function list(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  await requireOwner(userId, workspaceId);

  const now = new Date();
  const [members, invitations] = await Promise.all([
    db
      .select({
        userId: workspaceMemberships.userId,
        name: users.name,
        email: users.email,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(users.id, workspaceMemberships.userId))
      .where(eq(workspaceMemberships.workspaceId, workspaceId)),
    db
      .select({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt,
        createdAt: workspaceInvitations.createdAt,
      })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          gt(workspaceInvitations.expiresAt, now),
        ),
      ),
  ]);
  return { members, invitations };
}

export async function listReviewers(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);
  return db
    .select({
      userId: workspaceMemberships.userId,
      name: users.name,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        ne(workspaceMemberships.role, "viewer"),
      ),
    );
}

export async function createInvitation(
  userId: string,
  workspaceId: string,
  input: { email: string; role: "editor" | "viewer" },
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const validInput = workspaceInvitationCreateSchema.parse(input);
  await requireOwner(userId, workspaceId);

  const [existingMember] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(users.email, validInput.email),
      ),
    )
    .limit(1);
  if (existingMember) throw new Error("This person is already a workspace member");

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  const invitation = await db.transaction(async (tx) => {
    await tx
      .delete(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.email, validInput.email),
          isNull(workspaceInvitations.acceptedAt),
        ),
      );
    const [row] = await tx
      .insert(workspaceInvitations)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        email: validInput.email,
        role: validInput.role,
        tokenHash: tokenHash(token),
        invitedByUserId: userId,
        expiresAt,
        createdAt: now,
      })
      .returning();
    return row;
  });
  return { invitation, token };
}

export async function getValidInvitation(token: string) {
  if (!token) return null;
  const [invitation] = await db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      workspaceId: workspaceInvitations.workspaceId,
      workspaceName: workspaces.name,
      expiresAt: workspaceInvitations.expiresAt,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .where(
      and(
        eq(workspaceInvitations.tokenHash, tokenHash(token)),
        isNull(workspaceInvitations.acceptedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invitation ?? null;
}

export async function acceptInvitation(token: string, userId: string, email: string) {
  userIdSchema.parse(userId);
  const invitation = await getValidInvitation(token);
  if (!invitation || invitation.email !== email.trim().toLowerCase()) {
    throw new Error("Invitation is invalid or has expired");
  }

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(workspaceInvitations)
      .set({ acceptedAt: new Date(), acceptedByUserId: userId })
      .where(
        and(
          eq(workspaceInvitations.id, invitation.id),
          isNull(workspaceInvitations.acceptedAt),
          gt(workspaceInvitations.expiresAt, new Date()),
        ),
      )
      .returning({ id: workspaceInvitations.id });
    if (!claimed) throw new Error("Invitation is invalid or has expired");
    await tx.insert(workspaceMemberships).values({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });
  });
}

export async function updateRole(
  userId: string,
  workspaceId: string,
  memberUserId: string,
  role: "editor" | "viewer",
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  userIdSchema.parse(memberUserId);
  workspaceMemberRoleSchema.parse(role);
  await requireOwner(userId, workspaceId);
  const [updated] = await db
    .update(workspaceMemberships)
    .set({ role })
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, memberUserId),
        ne(workspaceMemberships.role, "owner"),
      ),
    )
    .returning({ userId: workspaceMemberships.userId });
  if (!updated) throw new Error("Workspace member not found or unauthorized");
}

export async function removeMember(userId: string, workspaceId: string, memberUserId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  userIdSchema.parse(memberUserId);
  await requireOwner(userId, workspaceId);
  const [removed] = await db
    .delete(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, memberUserId),
        ne(workspaceMemberships.role, "owner"),
      ),
    )
    .returning({ userId: workspaceMemberships.userId });
  if (!removed) throw new Error("Workspace member not found or unauthorized");
}

export async function revokeInvitation(userId: string, workspaceId: string, invitationId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(invitationId);
  await requireOwner(userId, workspaceId);
  const [removed] = await db
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.id, invitationId),
        eq(workspaceInvitations.workspaceId, workspaceId),
        isNull(workspaceInvitations.acceptedAt),
      ),
    )
    .returning({ id: workspaceInvitations.id });
  if (!removed) throw new Error("Workspace invitation not found or unauthorized");
}
