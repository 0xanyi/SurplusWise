import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, recurringOutgoings } from "@/db/schema";
import {
  assertRebillShape,
  normaliseRebillAmount,
  type RebillMode,
} from "@/lib/rebill";
import * as clientsService from "./clients";
import {
  userIdSchema,
  idSchema,
  recurringOutgoingCreateSchema,
  recurringOutgoingUpdateSchema,
  workspaceIdSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type OutgoingFrequency = "monthly";

export interface CreateInput {
  name: string;
  amount: number;
  dayOfMonth: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  vendor?: string | null;
  clientId?: string | null;
  rebillMode?: RebillMode;
  rebillAmount?: number | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  amount?: number;
  dayOfMonth?: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  vendor?: string | null;
  clientId?: string | null;
  rebillMode?: RebillMode;
  rebillAmount?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * List all recurring outgoings for a user, optionally only active ones.
 *
 * Left-joins the client so a row can say who it is carried for without the
 * caller making a second round trip per row.
 */
export async function list(userId: string, workspaceId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(recurringOutgoings.userId, userId), eq(recurringOutgoings.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(recurringOutgoings.isActive, isActive));

  return db
    .select({
      id: recurringOutgoings.id,
      name: recurringOutgoings.name,
      amount: recurringOutgoings.amount,
      dayOfMonth: recurringOutgoings.dayOfMonth,
      frequency: recurringOutgoings.frequency,
      category: recurringOutgoings.category,
      vendor: recurringOutgoings.vendor,
      clientId: recurringOutgoings.clientId,
      clientName: clients.name,
      rebillMode: recurringOutgoings.rebillMode,
      rebillAmount: recurringOutgoings.rebillAmount,
      notes: recurringOutgoings.notes,
      isActive: recurringOutgoings.isActive,
      createdAt: recurringOutgoings.createdAt,
      updatedAt: recurringOutgoings.updatedAt,
    })
    .from(recurringOutgoings)
    .leftJoin(clients, eq(recurringOutgoings.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(recurringOutgoings.dayOfMonth);
}

/**
 * Monthly commitment, split by who ultimately pays for it.
 *
 * `overhead` is what the workspace carries itself; `passThrough` is what it
 * fronts for someone else. `total` remains their sum, because the ledger never
 * nets a recovered cost away — see `lib/rebill.ts`.
 */
export async function getMonthlyTotal(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const [result] = await db
    .select({
      total: sql<string>`coalesce(sum(${recurringOutgoings.amount}), 0)`,
      count: sql<number>`count(*)`,
      overhead: sql<string>`coalesce(sum(${recurringOutgoings.amount}) filter (where ${recurringOutgoings.rebillMode} = 'none'), 0)`,
      passThrough: sql<string>`coalesce(sum(${recurringOutgoings.amount}) filter (where ${recurringOutgoings.rebillMode} <> 'none'), 0)`,
    })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.userId, userId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    );

  return {
    total: Number(result.total),
    count: result.count,
    overhead: Number(result.overhead),
    passThrough: Number(result.passThrough),
  };
}

/** Create a new recurring outgoing. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  recurringOutgoingCreateSchema.parse(input);
  const id = genId();
  const now = new Date();

  const rebillMode = input.rebillMode ?? "none";
  const clientId = input.clientId ?? null;
  const rebillAmount = normaliseRebillAmount(rebillMode, input.rebillAmount);
  assertRebillShape({ rebillMode, clientId, rebillAmount });
  if (clientId) await clientsService.assertInWorkspace(userId, workspaceId, clientId);

  const [row] = await db
    .insert(recurringOutgoings)
    .values({
      id,
      userId,
      workspaceId,
      name: input.name,
      amount: String(input.amount),
      dayOfMonth: input.dayOfMonth,
      frequency: input.frequency ?? "monthly",
      category: input.category ?? null,
      vendor: input.vendor ?? null,
      clientId,
      rebillMode,
      rebillAmount: rebillAmount === null ? null : String(rebillAmount),
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

  // The rebill fields are interdependent, so they are validated as the row will
  // end up rather than as the patch arrived: clearing the client on a row that
  // is still marked `at_cost` has to fail even though neither field is wrong on
  // its own.
  const rebillMode = input.rebillMode ?? (existing.rebillMode as RebillMode);
  const clientId = input.clientId !== undefined ? input.clientId : existing.clientId;
  const patchedAmount =
    input.rebillAmount !== undefined
      ? input.rebillAmount
      : existing.rebillAmount === null
        ? null
        : Number(existing.rebillAmount);
  const rebillAmount = normaliseRebillAmount(rebillMode, patchedAmount);
  assertRebillShape({ rebillMode, clientId, rebillAmount });

  const touchesRebill =
    input.rebillMode !== undefined ||
    input.clientId !== undefined ||
    input.rebillAmount !== undefined;

  if (touchesRebill && clientId && clientId !== existing.clientId) {
    // Validated against the row's own workspace rather than the active one, so
    // a client can never be attached across the isolation boundary.
    if (!existing.workspaceId) {
      throw new Error("This outgoing has no workspace, so it cannot be billed to a client");
    }
    await clientsService.assertInWorkspace(userId, existing.workspaceId, clientId);
  }

  const [row] = await db
    .update(recurringOutgoings)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.amount !== undefined && { amount: String(input.amount) }),
      ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.vendor !== undefined && { vendor: input.vendor }),
      ...(touchesRebill && {
        clientId,
        rebillMode,
        rebillAmount: rebillAmount === null ? null : String(rebillAmount),
      }),
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
