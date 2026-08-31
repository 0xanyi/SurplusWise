import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  recurringMoneyDraftSettlements,
  recurringMoneyDrafts,
  recurringOutgoings,
  transactions,
} from "@/db/schema";
import {
  amountSchema,
  idSchema,
  periodMonthSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

type TransactionType = "income" | "expense" | "giving";

export interface ImportMatchCandidate {
  key: string;
  amount: number;
  date: string;
  type: TransactionType;
  payee: string | null;
}

export interface DraftImportMatch {
  key: string;
  amount: number;
  draftId: string;
  recurringMoneyId: string;
  category: string | null;
  clientId: string | null;
  givingRecipientId: string | null;
  givingDesignationId: string | null;
}

export function dateForPeriod(periodMonth: string, dayOfMonth: number) {
  const [year, month] = periodMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periodMonth.slice(0, 8)}${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateDistance(left: string, right: string) {
  return Math.abs(
    (Date.parse(`${left}T00:00:00.000Z`) - Date.parse(`${right}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function moneyInPence(value: number | string) {
  return Math.round(Number(value) * 100);
}

function normalizedPayee(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "").trim() ?? "";
}

function payeesMatch(expected: string | null, actual: string | null) {
  const expectedValue = normalizedPayee(expected);
  if (!expectedValue) return true;
  const actualValue = normalizedPayee(actual);
  return Boolean(
    actualValue &&
      (actualValue.includes(expectedValue) || expectedValue.includes(actualValue)),
  );
}

export async function generate(workspaceId: string, periodMonth: string) {
  workspaceIdSchema.parse(workspaceId);
  periodMonthSchema.parse(periodMonth);
  const userId = await ownerUserId(workspaceId);

  const schedules = await db
    .select()
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    );
  if (schedules.length === 0) return [];

  const now = new Date();
  return db
    .insert(recurringMoneyDrafts)
    .values(
      schedules.map((schedule) => ({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        recurringMoneyId: schedule.id,
        periodMonth,
        dueDate: dateForPeriod(periodMonth, schedule.dayOfMonth),
        expectedAmount: schedule.amount,
        type: schedule.type,
        category: schedule.category,
        payee: schedule.vendor,
        clientId: schedule.clientId,
        givingRecipientId: schedule.givingRecipientId,
        givingDesignationId: schedule.givingDesignationId,
        notes: schedule.notes,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({
      target: [recurringMoneyDrafts.recurringMoneyId, recurringMoneyDrafts.periodMonth],
    })
    .returning();
}

export async function list(workspaceId: string, periodMonth: string) {
  workspaceIdSchema.parse(workspaceId);
  periodMonthSchema.parse(periodMonth);
  const drafts = await db
    .select({
      id: recurringMoneyDrafts.id,
      recurringMoneyId: recurringMoneyDrafts.recurringMoneyId,
      recurringMoneyName: recurringOutgoings.name,
      periodMonth: recurringMoneyDrafts.periodMonth,
      dueDate: recurringMoneyDrafts.dueDate,
      expectedAmount: recurringMoneyDrafts.expectedAmount,
      type: recurringMoneyDrafts.type,
      category: recurringMoneyDrafts.category,
      payee: recurringMoneyDrafts.payee,
      clientId: recurringMoneyDrafts.clientId,
      givingRecipientId: recurringMoneyDrafts.givingRecipientId,
      givingDesignationId: recurringMoneyDrafts.givingDesignationId,
      createdAt: recurringMoneyDrafts.createdAt,
      updatedAt: recurringMoneyDrafts.updatedAt,
    })
    .from(recurringMoneyDrafts)
    .innerJoin(
      recurringOutgoings,
      eq(recurringMoneyDrafts.recurringMoneyId, recurringOutgoings.id),
    )
    .where(
      and(
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
        eq(recurringMoneyDrafts.periodMonth, periodMonth),
      ),
    )
    .orderBy(recurringMoneyDrafts.dueDate);
  if (drafts.length === 0) return [];

  const settlements = await db
    .select({
      id: recurringMoneyDraftSettlements.id,
      draftId: recurringMoneyDraftSettlements.draftId,
      transactionId: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      payee: transactions.payee,
      createdAt: recurringMoneyDraftSettlements.createdAt,
    })
    .from(recurringMoneyDraftSettlements)
    .innerJoin(transactions, eq(recurringMoneyDraftSettlements.transactionId, transactions.id))
    .where(
      and(
        eq(recurringMoneyDraftSettlements.workspaceId, workspaceId),
        inArray(recurringMoneyDraftSettlements.draftId, drafts.map((draft) => draft.id)),
      ),
    );

  return drafts.map((draft) => {
    const matchedTransactions = settlements.filter((row) => row.draftId === draft.id);
    const recordedPence = matchedTransactions.reduce(
      (sum, row) => sum + moneyInPence(row.amount),
      0,
    );
    const expectedPence = moneyInPence(draft.expectedAmount);
    const recordedAmount = recordedPence / 100;
    return {
      ...draft,
      settlements: matchedTransactions,
      recordedAmount,
      outstandingAmount: Math.max(0, expectedPence - recordedPence) / 100,
      overpaidAmount: Math.max(0, recordedPence - expectedPence) / 100,
      status:
        recordedPence === 0
          ? ("draft" as const)
          : recordedPence < expectedPence
            ? ("partial" as const)
            : recordedPence === expectedPence
              ? ("settled" as const)
              : ("overpaid" as const),
    };
  });
}

async function recordedByDraft(draftIds: string[]) {
  if (draftIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({
      draftId: recurringMoneyDraftSettlements.draftId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(recurringMoneyDraftSettlements)
    .innerJoin(transactions, eq(recurringMoneyDraftSettlements.transactionId, transactions.id))
    .where(inArray(recurringMoneyDraftSettlements.draftId, draftIds))
    .groupBy(recurringMoneyDraftSettlements.draftId);
  return new Map(rows.map((row) => [row.draftId, Number(row.total)]));
}

/** Match high-confidence imports up to the remaining expected amount. */
export async function findImportMatches(
  workspaceId: string,
  candidates: ImportMatchCandidate[],
): Promise<DraftImportMatch[]> {
  workspaceIdSchema.parse(workspaceId);
  if (candidates.length === 0) return [];
  const dates = candidates.map((candidate) => candidate.date).sort();
  const drafts = await db
    .select()
    .from(recurringMoneyDrafts)
    .where(
      and(
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
        gte(recurringMoneyDrafts.dueDate, shiftDate(dates[0], -7)),
        lte(recurringMoneyDrafts.dueDate, shiftDate(dates.at(-1)!, 7)),
      ),
    );
  const recorded = await recordedByDraft(drafts.map((draft) => draft.id));
  const provisionallyMatched = new Map<string, number>();
  const matches: DraftImportMatch[] = [];

  for (const candidate of candidates) {
    const eligible = drafts.filter((draft) => {
      const alreadyRecorded = recorded.get(draft.id) ?? 0;
      const provisional = provisionallyMatched.get(draft.id) ?? 0;
      const outstanding = moneyInPence(draft.expectedAmount) - moneyInPence(alreadyRecorded + provisional);
      return (
        draft.type === candidate.type &&
        moneyInPence(candidate.amount) <= outstanding &&
        dateDistance(draft.dueDate, candidate.date) <= 7 &&
        payeesMatch(draft.payee, candidate.payee)
      );
    });
    if (eligible.length === 0) continue;

    const withExpectedPayee = eligible.filter((draft) => normalizedPayee(draft.payee));
    const pool = withExpectedPayee.length > 0 ? withExpectedPayee : eligible;
    const nearestDistance = Math.min(
      ...pool.map((draft) => dateDistance(draft.dueDate, candidate.date)),
    );
    const nearest = pool.filter(
      (draft) => dateDistance(draft.dueDate, candidate.date) === nearestDistance,
    );
    if (nearest.length !== 1) continue;
    if (!normalizedPayee(nearest[0].payee) && eligible.length !== 1) continue;

    const draft = nearest[0];
    provisionallyMatched.set(
      draft.id,
      (provisionallyMatched.get(draft.id) ?? 0) + candidate.amount,
    );
    matches.push({
      key: candidate.key,
      amount: candidate.amount,
      draftId: draft.id,
      recurringMoneyId: draft.recurringMoneyId,
      category: draft.category,
      clientId: draft.clientId,
      givingRecipientId: draft.givingRecipientId,
      givingDesignationId: draft.givingDesignationId,
    });
  }
  return matches;
}

export async function updateExpectedAmount(
  workspaceId: string,
  draftId: string,
  expectedAmount: number,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(draftId);
  amountSchema.parse(expectedAmount);
  const [row] = await db
    .update(recurringMoneyDrafts)
    .set({ expectedAmount: String(expectedAmount), updatedAt: new Date() })
    .where(
      and(
        eq(recurringMoneyDrafts.id, draftId),
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
      ),
    )
    .returning();
  if (!row) throw new Error("Recurring money draft not found or unauthorized");
  return row;
}

export async function matchTransaction(
  workspaceId: string,
  draftId: string,
  transactionId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(draftId);
  idSchema.parse(transactionId);
  const userId = await ownerUserId(workspaceId);
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select({ id: recurringMoneyDrafts.id, type: recurringMoneyDrafts.type })
      .from(recurringMoneyDrafts)
      .where(
        and(
          eq(recurringMoneyDrafts.id, draftId),
          eq(recurringMoneyDrafts.workspaceId, workspaceId),
        ),
      )
      .limit(1)
      .for("update");
    if (!draft) throw new Error("Recurring money draft not found or unauthorized");
    const [transaction] = await tx
      .select({ id: transactions.id, type: transactions.type })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!transaction) throw new Error("Transaction not found or unauthorized");
    if (transaction.type !== draft.type) {
      throw new Error("Transaction type must match the recurring money draft");
    }
    const [row] = await tx
      .insert(recurringMoneyDraftSettlements)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        draftId,
        transactionId,
      })
      .onConflictDoNothing({ target: recurringMoneyDraftSettlements.transactionId })
      .returning();
    if (!row) throw new Error("Transaction is already matched to recurring money");
    return row;
  });
}

export async function unmatch(
  workspaceId: string,
  draftId: string,
  transactionId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(draftId);
  idSchema.parse(transactionId);
  const deleted = await db
    .delete(recurringMoneyDraftSettlements)
    .where(
      and(
        eq(recurringMoneyDraftSettlements.draftId, draftId),
        eq(recurringMoneyDraftSettlements.transactionId, transactionId),
        eq(recurringMoneyDraftSettlements.workspaceId, workspaceId),
      ),
    )
    .returning({ id: recurringMoneyDraftSettlements.id });
  if (deleted.length === 0) throw new Error("Recurring money match not found or unauthorized");
}
