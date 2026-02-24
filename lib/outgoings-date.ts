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
