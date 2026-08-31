import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  clients,
  givingDesignations,
  givingRecipients,
  recurringMoneyDraftSettlements,
  recurringMoneyDrafts,
  recurringOutgoings,
  transactions,
} from "@/db/schema";
import {
  assertRebillShape,
  normaliseRebillAmount,
  type RebillMode,
} from "@/lib/rebill";
import { getPeriodMonthFromDate } from "@/lib/outgoings-date";
import * as clientsService from "./clients";
import * as givingRecipientsService from "./giving-recipients";
import * as draftsService from "./recurring-money-drafts";
import {
  boundedDateSchema,
  idSchema,
  periodMonthSchema,
  recurringOutgoingCreateSchema,
  recurringOutgoingUpdateSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

// ─── Types ───────────────────────────────────────────────────────────────────

type OutgoingFrequency = "monthly";
type RecurringMoneyType = "income" | "expense" | "giving";

export class RecurringMoneyShapeError extends Error {}

export interface CreateInput {
  name: string;
  amount: number;
  type?: RecurringMoneyType;
  dayOfMonth: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  vendor?: string | null;
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  rebillMode?: RebillMode;
  rebillAmount?: number | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  amount?: number;
  type?: RecurringMoneyType;
  dayOfMonth?: number;
  frequency?: OutgoingFrequency;
  category?: string | null;
  vendor?: string | null;
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  rebillMode?: RebillMode;
  rebillAmount?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

async function assertRecurringMoneyShape(
  workspaceId: string,
  input: {
    type: RecurringMoneyType;
    clientId: string | null;
    givingRecipientId: string | null;
    givingDesignationId: string | null;
    rebillMode: RebillMode;
    rebillAmount: number | null;
  },
) {
  if (input.type !== "expense" && (input.rebillMode !== "none" || input.rebillAmount !== null)) {
    throw new RecurringMoneyShapeError("Only recurring expenses can use client recovery terms");
  }
  if (input.type !== "expense" && input.clientId) {
    throw new RecurringMoneyShapeError("Clients can only be assigned to recurring expenses");
  }
  if (input.type !== "giving" && (input.givingRecipientId || input.givingDesignationId)) {
    throw new RecurringMoneyShapeError(
      "Giving attribution can only be assigned to recurring giving",
    );
  }
  if (input.givingDesignationId && !input.givingRecipientId) {
    throw new RecurringMoneyShapeError("A giving fund requires a recipient");
  }
  if (input.clientId) {
    await clientsService.assertInWorkspace(workspaceId, input.clientId);
  }
  if (input.givingRecipientId) {
    await givingRecipientsService.assertRecipientInWorkspace(
      workspaceId,
      input.givingRecipientId,
    );
    if (input.givingDesignationId) {
      await givingRecipientsService.assertDesignationInWorkspace(
        workspaceId,
        input.givingDesignationId,
        input.givingRecipientId,
      );
    }
  }
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * List all recurring outgoings for a user, optionally only active ones.
 *
 * Left-joins the client so a row can say who it is carried for without the
 * caller making a second round trip per row.
 */
export async function list(
  workspaceId: string,
  isActive?: boolean,
  type?: RecurringMoneyType,
) {
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(recurringOutgoings.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(recurringOutgoings.isActive, isActive));
  if (type !== undefined) conditions.push(eq(recurringOutgoings.type, type));

  return db
    .select({
      id: recurringOutgoings.id,
      name: recurringOutgoings.name,
      amount: recurringOutgoings.amount,
      type: recurringOutgoings.type,
      dayOfMonth: recurringOutgoings.dayOfMonth,
      frequency: recurringOutgoings.frequency,
      category: recurringOutgoings.category,
      vendor: recurringOutgoings.vendor,
      clientId: recurringOutgoings.clientId,
      clientName: clients.name,
      givingRecipientId: recurringOutgoings.givingRecipientId,
      givingRecipientName: givingRecipients.name,
      givingDesignationId: recurringOutgoings.givingDesignationId,
      givingDesignationName: givingDesignations.name,
      rebillMode: recurringOutgoings.rebillMode,
      rebillAmount: recurringOutgoings.rebillAmount,
      notes: recurringOutgoings.notes,
      isActive: recurringOutgoings.isActive,
      createdAt: recurringOutgoings.createdAt,
      updatedAt: recurringOutgoings.updatedAt,
    })
    .from(recurringOutgoings)
    .leftJoin(clients, eq(recurringOutgoings.clientId, clients.id))
    .leftJoin(givingRecipients, eq(recurringOutgoings.givingRecipientId, givingRecipients.id))
    .leftJoin(givingDesignations, eq(recurringOutgoings.givingDesignationId, givingDesignations.id))
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
export async function getMonthlyTotal(workspaceId: string) {
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
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
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
export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  recurringOutgoingCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const id = genId();
  const now = new Date();

  const rebillMode = input.rebillMode ?? "none";
  const clientId = input.clientId ?? null;
  const type = input.type ?? "expense";
  const givingRecipientId = input.givingRecipientId ?? null;
  const givingDesignationId = input.givingDesignationId ?? null;
  const rebillAmount = normaliseRebillAmount(rebillMode, input.rebillAmount);
  assertRebillShape({ rebillMode, clientId, rebillAmount });
  await assertRecurringMoneyShape(workspaceId, {
    type,
    clientId,
    givingRecipientId,
    givingDesignationId,
    rebillMode,
    rebillAmount,
  });

  const [row] = await db
    .insert(recurringOutgoings)
    .values({
      id,
      userId,
      workspaceId,
      name: input.name,
      amount: String(input.amount),
      type,
      dayOfMonth: input.dayOfMonth,
      frequency: input.frequency ?? "monthly",
      category: input.category ?? null,
      vendor: input.vendor ?? null,
      clientId,
      givingRecipientId,
      givingDesignationId,
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
export async function update(
  workspaceId: string,
  id: string,
  input: UpdateInput,
  expectedType?: RecurringMoneyType,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  recurringOutgoingUpdateSchema.parse(input);

  const ownership = [
    eq(recurringOutgoings.id, id),
    eq(recurringOutgoings.workspaceId, workspaceId),
  ];
  if (expectedType) ownership.push(eq(recurringOutgoings.type, expectedType));

  return db.transaction(async (tx) => {
    // Payment logging takes the same row lock, so a payment cannot race a type
    // change and leave a non-expense with an outgoing settlement.
    const [existing] = await tx
      .select()
      .from(recurringOutgoings)
      .where(and(...ownership))
      .limit(1)
      .for("update");

    if (!existing) throw new Error("Recurring outgoing not found or unauthorized");
    if (input.type !== undefined && input.type !== existing.type) {
      const [settlement] = await tx
        .select({ id: recurringMoneyDraftSettlements.id })
        .from(recurringMoneyDraftSettlements)
        .innerJoin(
          recurringMoneyDrafts,
          eq(recurringMoneyDraftSettlements.draftId, recurringMoneyDrafts.id),
        )
        .where(eq(recurringMoneyDrafts.recurringMoneyId, id))
        .limit(1);
      if (settlement) {
        throw new RecurringMoneyShapeError(
          "Unmatch this Recurring money from its Transactions before changing its type",
        );
      }
    }

    // The interdependent fields are validated as the row will end up rather
    // than independently as the patch arrived.
    const rebillMode = input.rebillMode ?? (existing.rebillMode as RebillMode);
    const clientId = input.clientId !== undefined ? input.clientId : existing.clientId;
    const type = input.type ?? existing.type;
    const givingRecipientId =
      input.givingRecipientId !== undefined
        ? input.givingRecipientId
        : existing.givingRecipientId;
    const givingDesignationId =
      input.givingDesignationId !== undefined
        ? input.givingDesignationId
        : existing.givingDesignationId;
    const patchedAmount =
      input.rebillAmount !== undefined
        ? input.rebillAmount
        : existing.rebillAmount === null
          ? null
          : Number(existing.rebillAmount);
    const rebillAmount = normaliseRebillAmount(rebillMode, patchedAmount);
    assertRebillShape({ rebillMode, clientId, rebillAmount });
    if (!existing.workspaceId) {
      throw new Error("This recurring item has no workspace, so it cannot be updated");
    }
    await assertRecurringMoneyShape(existing.workspaceId, {
      type,
      clientId,
      givingRecipientId,
      givingDesignationId,
      rebillMode,
      rebillAmount,
    });

    const touchesRebill =
      input.rebillMode !== undefined ||
      input.clientId !== undefined ||
      input.rebillAmount !== undefined;

    const [row] = await tx
      .update(recurringOutgoings)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.amount !== undefined && { amount: String(input.amount) }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.vendor !== undefined && { vendor: input.vendor }),
        ...(touchesRebill && {
          clientId,
          rebillMode,
          rebillAmount: rebillAmount === null ? null : String(rebillAmount),
        }),
        ...(input.givingRecipientId !== undefined && { givingRecipientId }),
        ...(input.givingDesignationId !== undefined && { givingDesignationId }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(and(...ownership))
      .returning();
    return row;
  });
}

/** Delete a recurring outgoing. Throws if not found / unauthorized. */
export async function remove(
  workspaceId: string,
  id: string,
  expectedType?: RecurringMoneyType,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  const ownership = [
    eq(recurringOutgoings.id, id),
    eq(recurringOutgoings.workspaceId, workspaceId),
  ];
  if (expectedType) ownership.push(eq(recurringOutgoings.type, expectedType));
  const [existing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(and(...ownership))
    .limit(1);

  if (!existing) throw new Error("Recurring outgoing not found or unauthorized");

  await db
    .delete(recurringOutgoings)
    .where(and(...ownership));
}

export class RecurringMoneySettlementError extends Error {}

const SETTLEMENT_TAG = "recurring-settlement";

function moneyInPence(value: number | string) {
  return Math.round(Number(value) * 100);
}

export async function settle(
  workspaceId: string,
  id: string,
  input: { paidAt: string; amount?: number; periodMonth?: string },
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  boundedDateSchema.parse(input.paidAt);
  const periodMonth = input.periodMonth ?? getPeriodMonthFromDate(input.paidAt);
  periodMonthSchema.parse(periodMonth);

  const [schedule] = await db
    .select()
    .from(recurringOutgoings)
    .where(and(eq(recurringOutgoings.id, id), eq(recurringOutgoings.workspaceId, workspaceId)))
    .limit(1);
  if (!schedule) throw new Error("Recurring money not found or unauthorized");

  await draftsService.generate(workspaceId, periodMonth);
  const userId = await ownerUserId(workspaceId);

  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(recurringMoneyDrafts)
      .where(
        and(
          eq(recurringMoneyDrafts.recurringMoneyId, id),
          eq(recurringMoneyDrafts.workspaceId, workspaceId),
          eq(recurringMoneyDrafts.periodMonth, periodMonth),
        ),
      )
      .limit(1)
      .for("update");
    if (!draft) throw new Error("Recurring money draft not found or unauthorized");

    const [recorded] = await tx
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(recurringMoneyDraftSettlements)
      .innerJoin(transactions, eq(recurringMoneyDraftSettlements.transactionId, transactions.id))
      .where(eq(recurringMoneyDraftSettlements.draftId, draft.id));

    const remainingPence = moneyInPence(draft.expectedAmount) - moneyInPence(recorded?.total ?? 0);
    if (remainingPence <= 0) {
      throw new RecurringMoneySettlementError("This month is already settled");
    }
    const requestedPence =
      input.amount === undefined ? remainingPence : moneyInPence(input.amount);
    if (!(requestedPence > 0)) {
      throw new RecurringMoneySettlementError("amount must be positive");
    }
    const amount = Math.min(requestedPence, remainingPence) / 100;

    const [transaction] = await tx
      .insert(transactions)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        amount: String(amount),
        date: input.paidAt,
        type: draft.type,
        status: "cleared",
        category: schedule.category ?? "Uncategorized",
        payee: schedule.vendor,
        clientId: schedule.clientId,
        givingRecipientId: schedule.givingRecipientId,
        givingDesignationId: schedule.givingDesignationId,
        notes: schedule.notes,
        tags: [SETTLEMENT_TAG],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await tx.insert(recurringMoneyDraftSettlements).values({
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      draftId: draft.id,
      transactionId: transaction.id,
    });

    return { transaction, draftId: draft.id };
  });
}

export async function unsettle(
  workspaceId: string,
  id: string,
  periodMonth: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  periodMonthSchema.parse(periodMonth);

  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select({ id: recurringMoneyDrafts.id })
      .from(recurringMoneyDrafts)
      .where(
        and(
          eq(recurringMoneyDrafts.recurringMoneyId, id),
          eq(recurringMoneyDrafts.workspaceId, workspaceId),
          eq(recurringMoneyDrafts.periodMonth, periodMonth),
        ),
      )
      .limit(1)
      .for("update");
    if (!draft) throw new Error("Recurring money draft not found or unauthorized");

    const settlements = await tx
      .select({
        transactionId: recurringMoneyDraftSettlements.transactionId,
      })
      .from(recurringMoneyDraftSettlements)
      .where(eq(recurringMoneyDraftSettlements.draftId, draft.id));
    if (settlements.length === 0) {
      throw new RecurringMoneySettlementError("This month is not settled");
    }

    for (const settlement of settlements) {
      const [transaction] = await tx
        .select({
          id: transactions.id,
          status: transactions.status,
          tags: transactions.tags,
        })
        .from(transactions)
        .where(
          and(eq(transactions.id, settlement.transactionId), eq(transactions.workspaceId, workspaceId)),
        )
        .limit(1);
      const tags = Array.isArray(transaction?.tags) ? transaction.tags : [];
      if (transaction && tags.includes(SETTLEMENT_TAG)) {
        if (transaction.status === "reconciled") {
          throw new Error("Reconciled transactions cannot be deleted");
        }
        await tx
          .delete(transactions)
          .where(and(eq(transactions.id, transaction.id), eq(transactions.workspaceId, workspaceId)));
      } else {
        await tx
          .delete(recurringMoneyDraftSettlements)
          .where(
            and(
              eq(recurringMoneyDraftSettlements.draftId, draft.id),
              eq(recurringMoneyDraftSettlements.transactionId, settlement.transactionId),
              eq(recurringMoneyDraftSettlements.workspaceId, workspaceId),
            ),
          );
      }
    }
  });
}
