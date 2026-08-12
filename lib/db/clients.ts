import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  clients,
  outgoingPaymentLogs,
  recurringOutgoings,
  transactions,
} from "@/db/schema";
import {
  rollUpClient,
  type ClientRollup,
  type FrontedPayment,
  type RebillMode,
} from "@/lib/rebill";
import {
  clientCreateSchema,
  clientUpdateSchema,
  idSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateInput {
  name: string;
  contactEmail?: string | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  contactEmail?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

/** A client plus everything the list and detail views need to show. */
export interface ClientWithRollup extends ClientRollup {
  id: string;
  name: string;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Active recurring costs carried for this client. */
  serviceCount: number;
  /** What those cost per month, at the current schedule. */
  monthlyFronted: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List clients in a workspace, optionally only active ones. */
export async function list(userId: string, workspaceId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const conditions = [eq(clients.userId, userId), eq(clients.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(clients.isActive, isActive));

  return db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(clients.name);
}

/** Fetch a single client (null if not found or wrong user). */
export async function getById(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Every client in the workspace with its recovery position.
 *
 * Four queries rather than one join: a client can have costs, tagged expenses
 * and tagged income independently, and joining all three at once multiplies the
 * rows against each other. The rollup is assembled in memory instead, which is
 * also where the arithmetic is unit-tested (`lib/rebill.ts`).
 */
export async function listWithRollups(
  userId: string,
  workspaceId: string,
  isActive?: boolean,
): Promise<ClientWithRollup[]> {
  const rows = await list(userId, workspaceId, isActive);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [paymentRows, serviceRows, transactionRows] = await Promise.all([
    // Costs actually paid on a client's behalf.
    db
      .select({
        clientId: recurringOutgoings.clientId,
        amountPaid: outgoingPaymentLogs.amount,
        rebillMode: recurringOutgoings.rebillMode,
        rebillAmount: recurringOutgoings.rebillAmount,
      })
      .from(outgoingPaymentLogs)
      .innerJoin(
        recurringOutgoings,
        eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id),
      )
      .where(
        and(
          eq(outgoingPaymentLogs.userId, userId),
          inArray(recurringOutgoings.clientId, ids),
        ),
      ),
    // The standing commitment, for "what this client costs me per month".
    //
    // The count covers every cycle, but only monthly rows are summed into a
    // monthly figure — the same guard `getMonthlyTotal` applies. Without it a
    // yearly renewal would be reported as if it were charged every month.
    db
      .select({
        clientId: recurringOutgoings.clientId,
        count: sql<number>`count(*)::int`,
        monthly: sql<string>`coalesce(sum(${recurringOutgoings.amount}) filter (where ${recurringOutgoings.frequency} = 'monthly'), 0)`,
      })
      .from(recurringOutgoings)
      .where(
        and(
          eq(recurringOutgoings.userId, userId),
          eq(recurringOutgoings.isActive, true),
          inArray(recurringOutgoings.clientId, ids),
        ),
      )
      .groupBy(recurringOutgoings.clientId),
    // One-off money tagged straight to a client.
    db
      .select({
        clientId: transactions.clientId,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.clientId, ids))),
  ]);

  const payments = new Map<string, FrontedPayment[]>();
  for (const row of paymentRows) {
    if (!row.clientId) continue;
    const list = payments.get(row.clientId) ?? [];
    list.push({
      amountPaid: Number(row.amountPaid),
      rebillMode: row.rebillMode as RebillMode,
      rebillAmount: row.rebillAmount === null ? null : Number(row.rebillAmount),
    });
    payments.set(row.clientId, list);
  }

  const taggedExpenses = new Map<string, number[]>();
  const taggedIncome = new Map<string, number[]>();
  for (const row of transactionRows) {
    if (!row.clientId) continue;
    // `giving` is not a client relationship; it is deliberately ignored rather
    // than folded into either side.
    const target =
      row.type === "income" ? taggedIncome : row.type === "expense" ? taggedExpenses : null;
    if (!target) continue;
    const list = target.get(row.clientId) ?? [];
    list.push(Number(row.amount));
    target.set(row.clientId, list);
  }

  const services = new Map(
    serviceRows
      .filter((row): row is typeof row & { clientId: string } => row.clientId !== null)
      .map((row) => [row.clientId, { count: row.count, monthly: Number(row.monthly) }]),
  );

  return rows.map((row) => {
    const service = services.get(row.id);
    return {
      id: row.id,
      name: row.name,
      contactEmail: row.contactEmail,
      notes: row.notes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      serviceCount: service?.count ?? 0,
      monthlyFronted: service?.monthly ?? 0,
      ...rollUpClient({
        payments: payments.get(row.id) ?? [],
        taggedExpenses: taggedExpenses.get(row.id) ?? [],
        taggedIncome: taggedIncome.get(row.id) ?? [],
      }),
    };
  });
}

/** One client with its recovery position. Throws if not found / unauthorized. */
export async function getWithRollup(
  userId: string,
  workspaceId: string,
  id: string,
): Promise<ClientWithRollup> {
  idSchema.parse(id);
  const all = await listWithRollups(userId, workspaceId);
  const found = all.find((row) => row.id === id);
  if (!found) throw new Error("Client not found or unauthorized");
  return found;
}

/** Create a new client. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const valid = clientCreateSchema.parse(input);
  const now = new Date();

  const [row] = await db
    .insert(clients)
    .values({
      id: genId(),
      userId,
      workspaceId,
      name: valid.name,
      contactEmail: valid.contactEmail ?? null,
      notes: valid.notes ?? null,
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
  const valid = clientUpdateSchema.parse(input);

  const existing = await getById(userId, id);
  if (!existing) throw new Error("Client not found or unauthorized");

  const [row] = await db
    .update(clients)
    .set({
      ...(valid.name !== undefined && { name: valid.name }),
      ...(valid.contactEmail !== undefined && { contactEmail: valid.contactEmail ?? null }),
      ...(valid.notes !== undefined && { notes: valid.notes ?? null }),
      ...(valid.isActive !== undefined && { isActive: valid.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, id), eq(clients.userId, userId)))
    .returning();
  return row;
}

/**
 * Delete a client, leaving their money in the ledger.
 *
 * The foreign keys are ON DELETE SET NULL, so costs and transactions survive
 * and only lose the attribution. But `chk_recurring_outgoings_rebill_client`
 * forbids a rebill mode without a client, and the FK would strand exactly that
 * combination — so the modes are reset to `none` first, in the same
 * transaction. Deleting without this step fails on the check constraint.
 */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const existing = await getById(userId, id);
  if (!existing) throw new Error("Client not found or unauthorized");

  await db.transaction(async (tx) => {
    await tx
      .update(recurringOutgoings)
      .set({ rebillMode: "none", rebillAmount: null, updatedAt: new Date() })
      .where(
        and(eq(recurringOutgoings.userId, userId), eq(recurringOutgoings.clientId, id)),
      );

    await tx.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  });
}

/**
 * Confirm a client belongs to this user and workspace.
 *
 * Used wherever a client id arrives from a request body, so a valid id from
 * another workspace cannot be attached to this one's money.
 */
export async function assertInWorkspace(
  userId: string,
  workspaceId: string,
  clientId: string,
): Promise<void> {
  idSchema.parse(clientId);
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.userId, userId),
        eq(clients.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Client not found or unauthorized");
}
