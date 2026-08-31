import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaceMemberships, workspaces } from "@/db/schema";
import { userIdSchema, idSchema, workspaceCreateSchema, workspaceIdSchema, workspaceUpdateSchema } from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkspaceType = "personal" | "business";
export type WorkspaceRole = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export interface CreateInput {
  name: string;
  type: WorkspaceType;
  currency?: string;
}

export interface UpdateInput {
  name?: string;
  type?: WorkspaceType;
  currency?: string;
  envelopeBudgetingEnabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

export function hasWorkspaceRole(
  role: WorkspaceRole,
  requiredRole: WorkspaceRole,
) {
  return ROLE_RANK[role] >= ROLE_RANK[requiredRole];
}

/** List all workspaces the user owns or belongs to. */
export async function list(userId: string) {
  userIdSchema.parse(userId);
  return db
    .select({
      id: workspaces.id,
      userId: workspaces.userId,
      name: workspaces.name,
      type: workspaces.type,
      currency: workspaces.currency,
      envelopeBudgetingEnabled: workspaces.envelopeBudgetingEnabled,
      isDefault: sql<boolean>`${workspaces.userId} = ${userId} and ${workspaces.isDefault}`,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: sql<WorkspaceRole>`case when ${workspaces.userId} = ${userId} then 'owner'::workspace_role else ${workspaceMemberships.role} end`,
    })
    .from(workspaces)
    .leftJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        eq(workspaceMemberships.userId, userId),
      ),
    )
    .where(
      or(
        eq(workspaces.userId, userId),
        isNotNull(workspaceMemberships.userId),
      ),
    )
    .orderBy(workspaces.createdAt);
}

export async function getAccess(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [row] = await db
    .select({
      workspace: workspaces,
      membershipRole: workspaceMemberships.role,
    })
    .from(workspaces)
    .leftJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        eq(workspaceMemberships.userId, userId),
      ),
    )
    .where(
      and(
        eq(workspaces.id, id),
        or(
          eq(workspaces.userId, userId),
          isNotNull(workspaceMemberships.userId),
        ),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    workspace: row.workspace,
    role: row.workspace.userId === userId ? "owner" : row.membershipRole!,
  };
}

/** Owner id stored on leftover books `user_id` columns. Not an isolation key. */
export async function ownerUserId(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);
  const [row] = await db
    .select({ userId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error("Workspace not found");
  return row.userId;
}

/** Get a single workspace by ID (null if not found or wrong user). */
export async function getById(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Get the user's default workspace, creating it if needed. */
export async function getOrCreateDefault(userId: string) {
  userIdSchema.parse(userId);

  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
    .limit(1);

  if (existing) return existing;

  const id = genId();
  const now = new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workspaces)
      .values({
        id,
        userId,
        name: "Personal",
        type: "personal",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(workspaceMemberships).values({
      workspaceId: id,
      userId,
      role: "owner",
      createdAt: now,
    });

    return row;
  });
}

/** Create a new workspace. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  const validInput = workspaceCreateSchema.parse(input);
  const id = genId();
  const now = new Date();

  // Check if any workspaces exist yet — first one gets isDefault
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workspaces)
      .values({
        id,
        userId,
        name: validInput.name,
        type: validInput.type,
        currency: validInput.currency,
        isDefault: existing.length === 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(workspaceMemberships).values({
      workspaceId: id,
      userId,
      role: "owner",
      createdAt: now,
    });

    return row;
  });
}

/** Update a workspace. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const validInput = workspaceUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Workspace not found or unauthorized");

  const [row] = await db
    .update(workspaces)
    .set({
      ...(validInput.name !== undefined && { name: validInput.name }),
      ...(validInput.type !== undefined && { type: validInput.type }),
      ...(validInput.currency !== undefined && { currency: validInput.currency }),
      ...(validInput.envelopeBudgetingEnabled !== undefined && {
        envelopeBudgetingEnabled: validInput.envelopeBudgetingEnabled,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .returning();
  return row;
}

/** Delete a workspace. Cannot delete the default workspace. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Workspace not found or unauthorized");
  if (existing.isDefault) throw new Error("Cannot delete the default workspace");

  await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
}
