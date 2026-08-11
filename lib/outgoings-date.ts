/** Date helpers for recurring outgoing payment periods and due-date logic. */

/** Format a Date as UTC YYYY-MM-DD. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Current date in UTC (YYYY-MM-DD). */
export function getCurrentUtcDate(): string {
  return formatUtcDate(new Date());
}

/** Derive a canonical period month (YYYY-MM-01) from a YYYY-MM-DD date string. */
export function getPeriodMonthFromDate(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Clamp day-of-month to the last day of the target month.
 * e.g. day 31 in February becomes Feb 28/29.
 */
export function getDueDateForMonth(
  year: number,
  monthIndex: number,
  dayOfMonth: number,
): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

/**
 * Returns true if the current month due date has passed.
 * Due date is considered passed only after that full day ends.
 */
export function isDueDatePassed(dayOfMonth: number, now: Date = new Date()): boolean {
  const dueDate = getDueDateForMonth(now.getFullYear(), now.getMonth(), dayOfMonth);
  const endOfDueDate = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
    23,
    59,
    59,
    999,
  );
  return now > endOfDueDate;
}

/**
 * Returns the next due date from a reference date.
 * If this month's due date is still upcoming (or today), returns this month.
 * Otherwise returns next month's due date.
 */
export function getNextDueDate(dayOfMonth: number, reference: Date): Date {
  const startOfToday = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const dueThisMonth = getDueDateForMonth(
    reference.getFullYear(),
    reference.getMonth(),
    dayOfMonth,
  );
  if (dueThisMonth >= startOfToday) return dueThisMonth;
  return getDueDateForMonth(reference.getFullYear(), reference.getMonth() + 1, dayOfMonth);
}

/**
 * The due date a bill should be judged against, given whether it has been paid.
 *
 * `getNextDueDate` always looks forward, so composing it with `getDueUrgency`
 * can never produce "overdue" — an unpaid bill whose day has passed rolls to
 * next month and reports as weeks away. That is right for a paid bill, which
 * has no outstanding obligation this cycle, and wrong for an unpaid one.
 */
export function getEffectiveDueDate(
  dayOfMonth: number,
  isPaid: boolean,
  reference: Date = new Date(),
): Date {
  if (!isPaid && isDueDatePassed(dayOfMonth, reference)) {
    return getDueDateForMonth(reference.getFullYear(), reference.getMonth(), dayOfMonth);
  }
  return getNextDueDate(dayOfMonth, reference);
}

/**
 * Calculate days until due date from today.
 * Returns negative if overdue.
 */
export function getDaysUntilDue(dueDate: Date, now: Date = new Date()): number {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = startOfDue.getTime() - startOfToday.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export interface DueState {
  dueDate: Date;
  daysUntilDue: number;
  urgency: DueUrgency;
  /** Already due — overdue or due today. The sidebar badge and the attention
   *  panel both key off this, so they cannot disagree about what "needs you"
   *  means, and "Coming up" is exactly its complement. */
  isDueNow: boolean;
}

/**
 * The whole due picture for one bill, in one call. Composing the three helpers
 * by hand at each call site is how the "overdue" branch went unreachable.
 */
export function getDueState(
  dayOfMonth: number,
  isPaid: boolean,
  reference: Date = new Date(),
): DueState {
  const dueDate = getEffectiveDueDate(dayOfMonth, isPaid, reference);
  const daysUntilDue = getDaysUntilDue(dueDate, reference);
  const urgency = getDueUrgency(daysUntilDue);
  return {
    dueDate,
    daysUntilDue,
    urgency,
    isDueNow: urgency === "overdue" || urgency === "today",
  };
}

/**
 * The same due picture for an absolute date rather than a repeating day.
 *
 * Statement due dates are exact calendar dates, not "the 15th of every month",
 * so they cannot roll forward the way a recurring bill does: a statement due on
 * the 3rd and still unpaid on the 20th is overdue, not due again next month.
 */
export function getDueStateForDate(
  dueDate: string,
  reference: Date = new Date(),
): DueState | null {
  const parts = dueDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  const daysUntilDue = getDaysUntilDue(parsed, reference);
  const urgency = getDueUrgency(daysUntilDue);

  return {
    dueDate: parsed,
    daysUntilDue,
    urgency,
    isDueNow: urgency === "overdue" || urgency === "today",
  };
}

/**
 * Get urgency level for a due date.
 */
export type DueUrgency = "overdue" | "today" | "soon" | "upcoming" | "future";

export function getDueUrgency(daysUntilDue: number): DueUrgency {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "today";
  if (daysUntilDue <= 3) return "soon";
  if (daysUntilDue <= 7) return "upcoming";
  return "future";
}

/**
 * Format days until due into human-readable string.
 */
export function formatDaysUntilDue(daysUntilDue: number): string {
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`;
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}
