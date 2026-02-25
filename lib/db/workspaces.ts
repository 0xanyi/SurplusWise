import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { userIdSchema, idSchema } from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkspaceType = "personal" | "business";

export interface CreateInput {
  name: string;
  type: WorkspaceType;
}

export interface UpdateInput {
  name?: string;
  type?: WorkspaceType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List all workspaces for a user. */
export async function list(userId: string) {
  userIdSchema.parse(userId);
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(workspaces.createdAt);
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
  const [row] = await db
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
  return row;
}

/** Create a new workspace. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  const id = genId();
  const now = new Date();

  // Check if any workspaces exist yet — first one gets isDefault
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1);

  const [row] = await db
    .insert(workspaces)
    .values({
      id,
      userId,
      name: input.name,
      type: input.type,
      isDefault: existing.length === 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Update a workspace. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Workspace not found or unauthorized");

  const [row] = await db
    .update(workspaces)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
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
