import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationStates } from "@/db/schema";
import * as calendarService from "./financial-calendar";
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

  const states = await db
    .select({ eventKey: notificationStates.eventKey, readAt: notificationStates.readAt })
    .from(notificationStates)
    .where(
      and(
        eq(notificationStates.userId, userId),
        eq(notificationStates.workspaceId, workspaceId),
        inArray(notificationStates.eventKey, events.map(({ eventKey }) => eventKey)),
      ),
    );
  const readByEvent = new Map(states.map((state) => [state.eventKey, state.readAt]));

  return events.map(({ event, eventKey, days }) => ({
    id: eventKey,
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
