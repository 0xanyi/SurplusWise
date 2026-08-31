import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, workspaces } from "@/db/schema";
import {
  ALL_DEFAULTS,
  type TransactionType,
} from "./default-categories";
import {
  idSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  transactionTypeSchema,
  workspaceIdSchema,
} from "./validation";
import { getMissingDefaults } from "./helpers";
import { ownerUserId } from "./workspaces";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateInput {
  name: string;
  type: TransactionType;
  color: string;
  icon?: string | null;
}

export interface UpdateInput {
  name?: string;
  color?: string;
  icon?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List categories, optionally filtered by type, sorted alphabetically. */
export async function list(workspaceId: string, type?: TransactionType) {
  workspaceIdSchema.parse(workspaceId);
  if (type) transactionTypeSchema.parse(type);
  const conditions = [eq(categories.workspaceId, workspaceId)];
  if (type) conditions.push(eq(categories.type, type));

  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.name));
}

/**
 * One-time seed per workspace.
 *
 * Uses workspaces.categoriesSeeded as a durable marker so defaults are never
 * re-created after they are renamed or deleted (even if every category in the
 * workspace is removed). Each workspace gets its own set: a business workspace
 * needs its own "Food & Dining" rather than sharing the personal one.
 */
export async function ensureDefaults(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);
  const userId = await ownerUserId(workspaceId);

  const [workspace] = await db
    .select({ id: workspaces.id, categoriesSeeded: workspaces.categoriesSeeded })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) throw new Error("Workspace not found or unauthorized");

  // Seed has already happened once for this workspace.
  if (workspace.categoriesSeeded) return { inserted: 0 };

  let inserted = 0;

  for (const [type, defaults] of Object.entries(ALL_DEFAULTS) as [TransactionType, typeof ALL_DEFAULTS[TransactionType]][]) {
    const existing = await db
      .select({ name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, workspaceId),
          eq(categories.type, type),
        ),
      );

    const { missing } = getMissingDefaults(
      existing.map((c) => c.name),
      defaults,
    );

    for (const cat of missing) {
      const result = await db
        .insert(categories)
        .values({
          id: genId(),
          userId,
          workspaceId,
          name: cat.name,
          type,
          color: cat.color,
          icon: cat.icon,
          isDefault: true,
        })
        .onConflictDoNothing({
          target: [
            categories.userId,
            categories.workspaceId,
            categories.type,
            categories.name,
          ],
        })
        .returning({ id: categories.id });
      if (result.length > 0) inserted++;
    }
  }

  // Mark seeded even if zero inserted (e.g. legacy workspaces already had categories).
  await db
    .update(workspaces)
    .set({ categoriesSeeded: true })
    .where(eq(workspaces.id, workspaceId));

  return { inserted };
}

/** Create a custom (non-default) category. Throws on duplicate name+type in workspace. */
export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  categoryCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.workspaceId, workspaceId),
        eq(categories.name, input.name),
        eq(categories.type, input.type),
      ),
    )
    .limit(1);

  if (existing) throw new Error("Category with this name already exists");

  const [row] = await db
    .insert(categories)
    .values({
      id: genId(),
      userId,
      workspaceId,
      name: input.name,
      type: input.type,
      color: input.color,
      icon: input.icon ?? null,
      isDefault: false,
    })
    .returning();
  return row;
}

/** Update a category. Throws if unauthorized. */
export async function update(workspaceId: string, id: string, input: UpdateInput) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  categoryUpdateSchema.parse(input);
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspaceId)))
    .limit(1);

  if (!cat) throw new Error("Category not found or unauthorized");

  if (input.name && input.name !== cat.name) {
    // Scoped to the category's own workspace: the same name in a sibling
    // workspace is a different category, not a clash.
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, workspaceId),
          eq(categories.type, cat.type),
          eq(categories.name, input.name),
        ),
      )
      .limit(1);

    if (existing) throw new Error("Category with this name already exists");
  }

  const [row] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.icon !== undefined && { icon: input.icon }),
    })
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspaceId)))
    .returning();
  return row;
}

/** Delete a category. Throws if unauthorized. */
export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspaceId)))
    .limit(1);

  if (!cat) throw new Error("Category not found or unauthorized");

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspaceId)));
}
