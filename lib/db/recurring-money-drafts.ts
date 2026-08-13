import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { recurringMoneyDrafts, recurringOutgoings, transactions } from "@/db/schema";
import { idSchema, periodMonthSchema, userIdSchema, workspaceIdSchema } from "./validation";

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
  draftId: string;
  recurringMoneyId: string;
  category: string | null;
  clientId: string | null;
  givingRecipientId: string | null;
  givingDesignationId: string | null;
}

function dateForPeriod(periodMonth: string, dayOfMonth: number) {
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

export async function generate(userId: string, workspaceId: string, periodMonth: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  periodMonthSchema.parse(periodMonth);

  const schedules = await db
    .select()
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.userId, userId),
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

export async function list(userId: string, workspaceId: string, periodMonth: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  periodMonthSchema.parse(periodMonth);
  return db
    .select({
      id: recurringMoneyDrafts.id,
      recurringMoneyId: recurringMoneyDrafts.recurringMoneyId,
      recurringMoneyName: recurringOutgoings.name,
      transactionId: recurringMoneyDrafts.transactionId,
      periodMonth: recurringMoneyDrafts.periodMonth,
      dueDate: recurringMoneyDrafts.dueDate,
      expectedAmount: recurringMoneyDrafts.expectedAmount,
      type: recurringMoneyDrafts.type,
      category: recurringMoneyDrafts.category,
      payee: recurringMoneyDrafts.payee,
      clientId: recurringMoneyDrafts.clientId,
      givingRecipientId: recurringMoneyDrafts.givingRecipientId,
      givingDesignationId: recurringMoneyDrafts.givingDesignationId,
      matchedAmount: transactions.amount,
      matchedDate: transactions.date,
      matchedPayee: transactions.payee,
      createdAt: recurringMoneyDrafts.createdAt,
      updatedAt: recurringMoneyDrafts.updatedAt,
    })
    .from(recurringMoneyDrafts)
    .innerJoin(
      recurringOutgoings,
      eq(recurringMoneyDrafts.recurringMoneyId, recurringOutgoings.id),
    )
    .leftJoin(transactions, eq(recurringMoneyDrafts.transactionId, transactions.id))
    .where(
      and(
        eq(recurringMoneyDrafts.userId, userId),
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
        eq(recurringMoneyDrafts.periodMonth, periodMonth),
      ),
    )
    .orderBy(recurringMoneyDrafts.dueDate);
}

/**
 * Match only high-confidence, exact-amount imports. A payee-bearing draft must
 * match payee text; a draft without one is accepted only when it is the sole
 * amount/type candidate in the seven-day window. Ties remain unmatched.
 */
export async function findImportMatches(
  userId: string,
  workspaceId: string,
  candidates: ImportMatchCandidate[],
): Promise<DraftImportMatch[]> {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (candidates.length === 0) return [];
  const dates = candidates.map((candidate) => candidate.date).sort();
  const drafts = await db
    .select()
    .from(recurringMoneyDrafts)
    .where(
      and(
        eq(recurringMoneyDrafts.userId, userId),
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
        isNull(recurringMoneyDrafts.transactionId),
        gte(recurringMoneyDrafts.dueDate, shiftDate(dates[0], -7)),
        lte(recurringMoneyDrafts.dueDate, shiftDate(dates.at(-1)!, 7)),
      ),
    );

  const reserved = new Set<string>();
  const matches: DraftImportMatch[] = [];
  for (const candidate of candidates) {
    const eligible = drafts.filter(
      (draft) =>
        !reserved.has(draft.id) &&
        draft.type === candidate.type &&
        moneyInPence(draft.expectedAmount) === moneyInPence(candidate.amount) &&
        dateDistance(draft.dueDate, candidate.date) <= 7 &&
        payeesMatch(draft.payee, candidate.payee),
    );
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
    reserved.add(draft.id);
    matches.push({
      key: candidate.key,
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

export async function unmatch(userId: string, workspaceId: string, draftId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(draftId);
  const [row] = await db
    .update(recurringMoneyDrafts)
    .set({ transactionId: null, updatedAt: new Date() })
    .where(
      and(
        eq(recurringMoneyDrafts.id, draftId),
        eq(recurringMoneyDrafts.userId, userId),
        eq(recurringMoneyDrafts.workspaceId, workspaceId),
      ),
    )
    .returning({ id: recurringMoneyDrafts.id });
  if (!row) throw new Error("Recurring money draft not found or unauthorized");
}
