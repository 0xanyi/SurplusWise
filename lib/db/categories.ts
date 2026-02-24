import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
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
export async function list(userId: string, type?: TransactionType) {
  userIdSchema.parse(userId);
  if (type) transactionTypeSchema.parse(type);
  const conditions = [eq(categories.userId, userId)];
  if (type) conditions.push(eq(categories.type, type));

  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.name));
}

/**
 * Idempotent: insert default categories that don't yet exist for this user.
 * Uses conflict-safe inserts to avoid race condition crashes when
 * multiple requests seed defaults concurrently.
 * Returns the count of newly-inserted rows.
 */
export async function ensureDefaults(userId: string) {
  userIdSchema.parse(userId);
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

  return { inserted };
}

/** Create a custom (non-default) category. Throws on duplicate name+type. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  categoryCreateSchema.parse(input);
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
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
      name: input.name,
      type: input.type,
      color: input.color,
      icon: input.icon ?? null,
      isDefault: false,
    })
    .returning();
  return row;
}

/** Update a non-default category. Throws if default or unauthorized. */
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
  if (cat.isDefault) throw new Error("Cannot modify default categories");

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

/** Delete a non-default category. Throws if default or unauthorized. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [cat] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);

  if (!cat) throw new Error("Category not found or unauthorized");
  if (cat.isDefault) throw new Error("Cannot delete default categories");

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
}
