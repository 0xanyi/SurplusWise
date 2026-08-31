import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationStates, workspaces } from "@/db/schema";
import { getBackupStatus } from "@/lib/backup-status";
import * as budgetsService from "./budgets";
import * as calendarService from "./financial-calendar";
import * as transactionsService from "./transactions";
import { idSchema, userIdSchema, workspaceIdSchema } from "./validation";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";

const DUE_WINDOW_DAYS = 7;
const BACKUP_STALE_MS = 48 * 60 * 60 * 1000;

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
  kind: "due_money" | "review_item" | "budget_limit" | "stale_backup";
  date: string;
  title: string;
  description: string;
  amount: number | null;
  type: calendarService.CalendarEventType | null;
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

export async function listDue(
  workspaceId: string,
  recipientUserId: string,
  today = getCurrentUtcDate(),
) {
  userIdSchema.parse(recipientUserId);
  workspaceIdSchema.parse(workspaceId);
  const periodMonth = getPeriodMonthFromDate(today);
  const [current, next] = await Promise.all([
    calendarService.getMonth(workspaceId, periodMonth),
    calendarService.getMonth(workspaceId, shiftMonth(periodMonth)),
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

  const readByEvent = await readState(
    recipientUserId,
    workspaceId,
    events.map(({ eventKey }) => eventKey),
  );

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

export async function listReviewItems(
  workspaceId: string,
  recipientUserId: string,
) {
  userIdSchema.parse(recipientUserId);
  workspaceIdSchema.parse(workspaceId);
  const transactions = await transactionsService.list(workspaceId, { needsReview: true });
  const eventKeys = transactions.map((transaction) => `transaction-review:${transaction.id}`);
  const readByEvent = await readState(recipientUserId, workspaceId, eventKeys);

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
  workspaceId: string,
  recipientUserId: string,
  today = getCurrentUtcDate(),
) {
  userIdSchema.parse(recipientUserId);
  workspaceIdSchema.parse(workspaceId);
  const budgets = (await budgetsService.getWithSpending(workspaceId))
    .filter((budget) => (
      budget.type !== "income"
      && budget.startDate <= today
      && budget.endDate >= today
      && budget.percentUsed >= 80
    ));
  const eventKeys = budgets.map((budget) => {
    const threshold = budget.percentUsed >= 100 ? "exceeded" : "warning";
    return `budget-limit:${budget.id}:${threshold}`;
  });
  const readByEvent = await readState(recipientUserId, workspaceId, eventKeys);

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

export async function listBackupAlerts(
  workspaceId: string,
  recipientUserId: string,
  now = new Date(),
) {
  userIdSchema.parse(recipientUserId);
  workspaceIdSchema.parse(workspaceId);
  const [workspace] = await db
    .select({ userId: workspaces.userId, isDefault: workspaces.isDefault })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace || workspace.userId !== recipientUserId || !workspace.isDefault) return [];

  const status = await getBackupStatus();
  if (!status.configured) return [];
  const stale = !status.lastSuccessfulAt
    || now.getTime() - status.lastSuccessfulAt.getTime() > BACKUP_STALE_MS;
  if (!stale) return [];

  const occurrence = status.lastSuccessfulAt?.toISOString() ?? "never";
  const eventKey = `backup-stale:${occurrence}`;
  const readByEvent = await readState(recipientUserId, workspaceId, [eventKey]);
  const days = status.lastSuccessfulAt
    ? Math.floor((now.getTime() - status.lastSuccessfulAt.getTime()) / 86_400_000)
    : null;
  return [{
    id: eventKey,
    kind: "stale_backup",
    date: (status.lastSuccessfulAt ?? now).toISOString().slice(0, 10),
    title: status.lastSuccessfulAt ? "Database backup is stale" : "No backup has been reported",
    description: days === null
      ? "Run and validate a database backup"
      : `Last successful backup was ${days} days ago`,
    amount: null,
    type: null,
    daysUntilDue: null,
    href: "/dashboard/settings#data-resilience",
    readAt: readByEvent.get(eventKey) ?? null,
  }] satisfies Notification[];
}

/** All current attention items; resolved source records disappear automatically. */
export async function listCurrent(
  workspaceId: string,
  recipientUserId: string,
  today = getCurrentUtcDate(),
) {
  const [due, reviewItems, budgetLimits, backupAlerts] = await Promise.all([
    listDue(workspaceId, recipientUserId, today),
    listReviewItems(workspaceId, recipientUserId),
    listBudgetLimits(workspaceId, recipientUserId, today),
    listBackupAlerts(workspaceId, recipientUserId),
  ]);
  return [...due, ...reviewItems, ...budgetLimits, ...backupAlerts];
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
      target: [
        notificationStates.userId,
        notificationStates.workspaceId,
        notificationStates.eventKey,
      ],
      set: { readAt: now, updatedAt: now },
    });
}
