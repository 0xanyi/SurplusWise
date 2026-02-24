import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { recurringOutgoings } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  recurringOutgoingCreateSchema,
  recurringOutgoingUpdateSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type OutgoingFrequency = "monthly";

export interface CreateInput {
  name: string;
  amount: number;
  dayOfMonth: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  amount?: number;
  dayOfMonth?: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List all recurring outgoings for a user, optionally only active ones. */
export async function list(userId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  const conditions = [eq(recurringOutgoings.userId, userId)];
  if (isActive !== undefined) conditions.push(eq(recurringOutgoings.isActive, isActive));

  return db
    .select()
    .from(recurringOutgoings)
    .where(and(...conditions))
    .orderBy(recurringOutgoings.dayOfMonth);
}

/** Get the total monthly outgoings for a user. */
export async function getMonthlyTotal(userId: string) {
  userIdSchema.parse(userId);

  const [result] = await db
    .select({
      total: sql<string>`coalesce(sum(${recurringOutgoings.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.userId, userId),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    );

  return {
    total: Number(result.total),
    count: result.count,
  };
}

/** Create a new recurring outgoing. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  recurringOutgoingCreateSchema.parse(input);
  const id = genId();
  const now = new Date();

  const [row] = await db
    .insert(recurringOutgoings)
    .values({
      id,
      userId,
      name: input.name,
      amount: String(input.amount),
      dayOfMonth: input.dayOfMonth,
      frequency: input.frequency ?? "monthly",
      category: input.category ?? null,
      notes: input.notes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  recurringOutgoingUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(recurringOutgoings)
    .where(and(eq(recurringOutgoings.id, id), eq(recurringOutgoings.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Recurring outgoing not found or unauthorized");

  const [row] = await db
    .update(recurringOutgoings)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.amount !== undefined && { amount: String(input.amount) }),
      ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(recurringOutgoings.id, id), eq(recurringOutgoings.userId, userId)))
    .returning();
  return row;
}

/** Delete a recurring outgoing. Throws if not found / unauthorized. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(and(eq(recurringOutgoings.id, id), eq(recurringOutgoings.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Recurring outgoing not found or unauthorized");

  await db
    .delete(recurringOutgoings)
    .where(and(eq(recurringOutgoings.id, id), eq(recurringOutgoings.userId, userId)));
}
