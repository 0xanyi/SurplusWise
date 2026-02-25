import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import {
  ALL_DEFAULTS,
  type TransactionType,
} from "./default-categories";
import {
  userIdSchema,
  idSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  transactionTypeSchema,
  workspaceIdSchema,
} from "./validation";
import { getMissingDefaults } from "./helpers";

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
export async function list(userId: string, workspaceId: string, type?: TransactionType) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (type) transactionTypeSchema.parse(type);
  const conditions = [
    eq(categories.userId, userId),
    eq(categories.workspaceId, workspaceId),
  ];
  if (type) conditions.push(eq(categories.type, type));

  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.name));
}

/**
 * One-time seed per user.
 *
 * Uses users.categoriesSeeded as a durable marker so defaults are never
 * re-created after a user renames/deletes them (even if all categories are removed).
 *
 * Seeds categories into the given workspace.
 */
export async function ensureDefaults(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const [user] = await db
    .select({ id: users.id, categoriesSeeded: users.categoriesSeeded })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found or unauthorized");

  // Seed has already happened once for this user.
  if (user.categoriesSeeded) return { inserted: 0 };

  let inserted = 0;

  for (const [type, defaults] of Object.entries(ALL_DEFAULTS) as [TransactionType, typeof ALL_DEFAULTS[TransactionType]][]) {
    const existing = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.type, type)));

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
          target: [categories.userId, categories.type, categories.name],
        })
        .returning({ id: categories.id });
      if (result.length > 0) inserted++;
    }
  }

  // Mark seeded even if zero inserted (e.g. legacy users already had categories).
  await db
    .update(users)
    .set({ categoriesSeeded: true })
    .where(eq(users.id, userId));

  return { inserted };
}

/** Create a custom (non-default) category. Throws on duplicate name+type in workspace. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  categoryCreateSchema.parse(input);
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
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
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  categoryUpdateSchema.parse(input);
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);

  if (!cat) throw new Error("Category not found or unauthorized");

  if (input.name && input.name !== cat.name) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
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
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  return row;
}

/** Delete a category. Throws if unauthorized. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);

  if (!cat) throw new Error("Category not found or unauthorized");

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
}
