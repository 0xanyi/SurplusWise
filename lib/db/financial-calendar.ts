import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  debtPayments,
  debtsCredits,
  debtStatements,
} from "@/db/schema";
import { forecastMinimumPayment, isRevolvingDebt } from "@/lib/debt-interest";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";
import { periodMonthSchema, workspaceIdSchema } from "./validation";

export type CalendarEventType = "income" | "expense" | "giving" | "debt";
export type CalendarEventStatus =
  | "unsettled"
  | "partial"
  | "settled"
  | "overpaid"
  | "scheduled";

export interface FinancialCalendarEvent {
  id: string;
  sourceId: string;
  source: "recurring" | "debt";
  date: string;
  title: string;
  amount: number;
  type: CalendarEventType;
  status: CalendarEventStatus;
  certainty: "expected" | "statement" | "estimate";
  recordedAmount: number;
  outstandingAmount: number;
  href: string;
}

function monthEnd(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function dateInMonth(periodMonth: string, day: number) {
  const lastDay = Number(monthEnd(periodMonth).slice(8));
  return `${periodMonth.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function dayAfter(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: string | null) {
  return value == null ? null : Number(value);
}

function settlement(recordedAmount: number, amount: number) {
  const recordedPence = Math.round(recordedAmount * 100);
  const expectedPence = Math.round(amount * 100);
  return {
    recordedAmount: recordedPence / 100,
    outstandingAmount: Math.max(0, expectedPence - recordedPence) / 100,
    status:
      recordedPence === 0
        ? ("scheduled" as const)
        : recordedPence < expectedPence
          ? ("partial" as const)
          : recordedPence === expectedPence
            ? ("settled" as const)
            : ("overpaid" as const),
  };
}

async function listDebtEvents(workspaceId: string, periodMonth: string) {
  const endDate = monthEnd(periodMonth);
  const statements = await db
    .select({
      id: debtStatements.id,
      debtId: debtsCredits.id,
      name: debtsCredits.name,
      dueDate: debtStatements.dueDate,
      periodEnd: debtStatements.periodEnd,
      minimumPayment: debtStatements.minimumPayment,
      configuredMinimum: debtsCredits.minimumPayment,
      closingBalance: debtStatements.closingBalance,
      debtType: debtsCredits.debtType,
      minPaymentPercent: debtsCredits.minPaymentPercent,
      minPaymentFloor: debtsCredits.minPaymentFloor,
      interestCharged: debtStatements.interestCharged,
      feesCharged: debtStatements.feesCharged,
    })
    .from(debtStatements)
    .innerJoin(debtsCredits, eq(debtStatements.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtStatements.dueDate, periodMonth),
        lte(debtStatements.dueDate, endDate),
      ),
    )
    .orderBy(asc(debtStatements.dueDate), asc(debtsCredits.name));

  const statementDebtIds = new Set(statements.map((statement) => statement.debtId));
  const activeDebts = await db
    .select({
      id: debtsCredits.id,
      name: debtsCredits.name,
      currentBalance: debtsCredits.currentBalance,
      minimumPayment: debtsCredits.minimumPayment,
      minPaymentPercent: debtsCredits.minPaymentPercent,
      minPaymentFloor: debtsCredits.minPaymentFloor,
      paymentDayOfMonth: debtsCredits.paymentDayOfMonth,
      debtType: debtsCredits.debtType,
    })
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.workspaceId, workspaceId),
        eq(debtsCredits.isActive, true),
      ),
    )
    .orderBy(asc(debtsCredits.name));

  const latestStatements = await db
    .selectDistinctOn([debtStatements.debtId], {
      debtId: debtStatements.debtId,
      interestCharged: debtStatements.interestCharged,
      feesCharged: debtStatements.feesCharged,
    })
    .from(debtStatements)
    .innerJoin(debtsCredits, eq(debtStatements.debtId, debtsCredits.id))
    .where(eq(debtsCredits.workspaceId, workspaceId))
    .orderBy(desc(debtStatements.debtId), desc(debtStatements.periodEnd));
  const latestByDebt = new Map(latestStatements.map((row) => [row.debtId, row]));
  const paymentStart = [
    periodMonth,
    ...statements.map((statement) => dayAfter(statement.periodEnd)),
  ].sort()[0];
  const payments = await db
    .select({
      debtId: debtPayments.debtId,
      amount: debtPayments.amount,
      paidAt: debtPayments.paidAt,
    })
    .from(debtPayments)
    .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtPayments.paidAt, paymentStart),
        lte(debtPayments.paidAt, endDate),
      ),
    );

  const recordedFor = (debtId: string, startDate: string) =>
    payments
      .filter((payment) => payment.debtId === debtId && payment.paidAt >= startDate)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const statementEvents: FinancialCalendarEvent[] = statements.flatMap((statement) => {
    if (!statement.dueDate) return [];
    const balance = Number(statement.closingBalance);
    const configured = numberOrNull(statement.configuredMinimum);
    const stated = numberOrNull(statement.minimumPayment);
    const forecast = isRevolvingDebt(statement.debtType)
      ? forecastMinimumPayment(
          balance,
          Number(statement.interestCharged),
          Number(statement.feesCharged),
          {
            percent: numberOrNull(statement.minPaymentPercent),
            floor: numberOrNull(statement.minPaymentFloor),
          },
        )
      : null;
    const amount = stated ?? configured ?? forecast;
    if (amount == null || amount <= 0) return [];
    const amounts = settlement(recordedFor(statement.debtId, dayAfter(statement.periodEnd)), amount);
    return [{
      id: `debt-statement:${statement.id}`,
      sourceId: statement.debtId,
      source: "debt" as const,
      date: statement.dueDate,
      title: statement.name,
      amount,
      type: "debt" as const,
      status: amounts.status,
      certainty: stated != null ? ("statement" as const) : ("estimate" as const),
      recordedAmount: amounts.recordedAmount,
      outstandingAmount: amounts.outstandingAmount,
      href: `/dashboard/debts/${statement.debtId}`,
    }];
  });

  const forecastEvents: FinancialCalendarEvent[] = activeDebts.flatMap((debt) => {
    if (
      statementDebtIds.has(debt.id) ||
      debt.paymentDayOfMonth == null ||
      Number(debt.currentBalance) <= 0
    ) {
      return [];
    }
    const latest = latestByDebt.get(debt.id);
    const configured = numberOrNull(debt.minimumPayment);
    const forecast = isRevolvingDebt(debt.debtType)
      ? forecastMinimumPayment(
          Number(debt.currentBalance),
          Number(latest?.interestCharged ?? 0),
          Number(latest?.feesCharged ?? 0),
          {
            percent: numberOrNull(debt.minPaymentPercent),
            floor: numberOrNull(debt.minPaymentFloor),
          },
        )
      : null;
    const amount = configured ?? forecast;
    if (amount == null || amount <= 0) return [];
    const amounts = settlement(recordedFor(debt.id, periodMonth), amount);
    return [{
      id: `debt:${debt.id}:${periodMonth}`,
      sourceId: debt.id,
      source: "debt" as const,
      date: dateInMonth(periodMonth, debt.paymentDayOfMonth),
      title: debt.name,
      amount,
      type: "debt" as const,
      status: amounts.status,
      certainty: "estimate" as const,
      recordedAmount: amounts.recordedAmount,
      outstandingAmount: amounts.outstandingAmount,
      href: `/dashboard/debts/${debt.id}`,
    }];
  });

  return [...statementEvents, ...forecastEvents];
}

/** Return one workspace month without adding expectations to the ledger. */
export async function getMonth(workspaceId: string, periodMonth: string) {
  workspaceIdSchema.parse(workspaceId);
  periodMonthSchema.parse(periodMonth);

  const [occurrences, debtEvents] = await Promise.all([
    recurringMoneyOccurrences.month(workspaceId, periodMonth),
    listDebtEvents(workspaceId, periodMonth),
  ]);
  const recurringEvents: FinancialCalendarEvent[] = occurrences.occurrences.map((occurrence) => ({
    id: occurrence.id,
    sourceId: occurrence.recurringMoneyId,
    source: "recurring",
    date: occurrence.dueDate,
    title: occurrence.name,
    amount: occurrence.expectedAmount,
    type: occurrence.type,
    status: occurrence.status,
    certainty: "expected",
    recordedAmount: occurrence.recordedAmount,
    outstandingAmount: occurrence.outstandingAmount,
    href: "/dashboard/outgoings",
  }));
  const events = [...recurringEvents, ...debtEvents].sort(
    (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
  );

  return {
    periodMonth,
    events,
    summary: {
      expectedIncome: events
        .filter((event) => event.type === "income")
        .reduce((sum, event) => sum + event.amount, 0),
      expectedOutflow: events
        .filter((event) => event.type !== "income")
        .reduce((sum, event) => sum + event.amount, 0),
      incomingOutstanding: events
        .filter((event) => event.type === "income")
        .reduce((sum, event) => sum + event.outstandingAmount, 0),
      outgoingOutstanding: events
        .filter((event) => event.type !== "income")
        .reduce((sum, event) => sum + event.outstandingAmount, 0),
    },
  };
}
