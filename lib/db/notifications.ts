import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationStates } from "@/db/schema";
import * as budgetsService from "./budgets";
import * as calendarService from "./financial-calendar";
import * as transactionsService from "./transactions";
import { idSchema, userIdSchema, workspaceIdSchema } from "./validation";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";

const DUE_WINDOW_DAYS = 7;

function shiftMonth(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function daysFromToday(date: string, today: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}

function description(type: calendarService.CalendarEventType, days: number) {
  const subject = type === "income" ? "Expected income" : "Payment";
  if (days < 0) return `${subject} was due ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return `${subject} is due today`;
  if (days === 1) return `${subject} is due tomorrow`;
  return `${subject} is due in ${days} days`;
}

type Notification = {
  id: string;
  kind: "due_money" | "review_item" | "budget_limit";
  date: string;
  title: string;
  description: string;
  amount: number;
  type: calendarService.CalendarEventType;
  daysUntilDue: number | null;
  href: string;
  readAt: Date | null;
};

async function readState(userId: string, workspaceId: string, eventKeys: string[]) {
  if (eventKeys.length === 0) return new Map<string, Date>();
  const states = await db
    .select({ eventKey: notificationStates.eventKey, readAt: notificationStates.readAt })
    .from(notificationStates)
    .where(
      and(
        eq(notificationStates.userId, userId),
        eq(notificationStates.workspaceId, workspaceId),
        inArray(notificationStates.eventKey, eventKeys),
      ),
    );
  return new Map(states.map((state) => [state.eventKey, state.readAt]));
}

export async function listDue(userId: string, workspaceId: string, today = getCurrentUtcDate()) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const periodMonth = getPeriodMonthFromDate(today);
  const [current, next] = await Promise.all([
    calendarService.getMonth(userId, workspaceId, periodMonth),
    calendarService.getMonth(userId, workspaceId, shiftMonth(periodMonth)),
  ]);
  const events = [...current.events, ...next.events]
    .map((event) => ({
      event,
      eventKey: `${event.source}:${event.sourceId}:${event.date}`,
      days: daysFromToday(event.date, today),
    }))
    .filter(({ event, days }) => event.outstandingAmount > 0 && days <= DUE_WINDOW_DAYS)
    .sort((left, right) => left.event.date.localeCompare(right.event.date));
  if (events.length === 0) return [];

  const readByEvent = await readState(userId, workspaceId, events.map(({ eventKey }) => eventKey));

  return events.map(({ event, eventKey, days }): Notification => ({
    id: eventKey,
    kind: "due_money",
    date: event.date,
    title: event.title,
    description: description(event.type, days),
    amount: event.outstandingAmount,
    type: event.type,
    daysUntilDue: days,
    href: event.href,
    readAt: readByEvent.get(eventKey) ?? null,
  }));
}

export async function listReviewItems(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const transactions = await transactionsService.list(userId, workspaceId, { needsReview: true });
  const eventKeys = transactions.map((transaction) => `transaction-review:${transaction.id}`);
  const readByEvent = await readState(userId, workspaceId, eventKeys);

  return transactions.map((transaction, index): Notification => {
    const eventKey = eventKeys[index];
    const subject = transaction.payee?.trim() || transaction.category;
    return {
      id: eventKey,
      kind: "review_item",
      date: transaction.date,
      title: "Review imported transaction",
      description: `${subject} needs classification review`,
      amount: Number(transaction.amount),
      type: transaction.type,
      daysUntilDue: null,
      href: "/dashboard/transactions?needsReview=true",
      readAt: readByEvent.get(eventKey) ?? null,
    };
  });
}

export async function listBudgetLimits(
  userId: string,
  workspaceId: string,
  today = getCurrentUtcDate(),
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const budgets = (await budgetsService.getWithSpending(userId, workspaceId))
    .filter((budget) => (
      budget.startDate <= today
      && budget.endDate >= today
      && budget.percentUsed >= 80
    ));
  const eventKeys = budgets.map((budget) => {
    const threshold = budget.percentUsed >= 100 ? "exceeded" : "warning";
    return `budget-limit:${budget.id}:${threshold}`;
  });
  const readByEvent = await readState(userId, workspaceId, eventKeys);

  return budgets.map((budget, index): Notification => {
    const exceeded = budget.percentUsed >= 100;
    const eventKey = eventKeys[index];
    return {
      id: eventKey,
      kind: "budget_limit",
      date: budget.endDate,
      title: exceeded
        ? `${budget.category} budget has been exceeded`
        : `${budget.category} budget is near its limit`,
      description: `${Math.round(budget.percentUsed)}% of budget used`,
      amount: Number(budget.amount),
      type: budget.type,
      daysUntilDue: null,
      href: "/dashboard/settings#budgets",
      readAt: readByEvent.get(eventKey) ?? null,
    };
  });
}

/** All current attention items; resolved source records disappear automatically. */
export async function listCurrent(userId: string, workspaceId: string, today = getCurrentUtcDate()) {
  const [due, reviewItems, budgetLimits] = await Promise.all([
    listDue(userId, workspaceId, today),
    listReviewItems(userId, workspaceId),
    listBudgetLimits(userId, workspaceId, today),
  ]);
  return [...due, ...reviewItems, ...budgetLimits];
}

export async function markRead(
  userId: string,
  workspaceId: string,
  eventKey: string,
  read: boolean,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(eventKey);
  if (!read) {
    await db
      .delete(notificationStates)
      .where(
        and(
          eq(notificationStates.userId, userId),
          eq(notificationStates.workspaceId, workspaceId),
          eq(notificationStates.eventKey, eventKey),
        ),
      );
    return;
  }
  const now = new Date();
  await db
    .insert(notificationStates)
    .values({
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      eventKey,
      readAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [notificationStates.workspaceId, notificationStates.eventKey],
      set: { readAt: now, updatedAt: now },
    });
}
