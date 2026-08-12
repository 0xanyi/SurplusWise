export type GivingCommitmentFrequency = "one_time" | "monthly" | "quarterly" | "yearly";

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + months;
  const day = value.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

/** Number of scheduled gifts due inside an inclusive reporting period. */
export function countCommitmentOccurrences(input: {
  frequency: GivingCommitmentFrequency;
  startDate: string;
  endDate: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  const scheduleEnd = input.endDate && input.endDate < input.periodEnd
    ? input.endDate
    : input.periodEnd;
  if (input.startDate > scheduleEnd) return 0;
  if (input.frequency === "one_time") {
    return input.startDate >= input.periodStart && input.startDate <= scheduleEnd ? 1 : 0;
  }

  const step = input.frequency === "monthly" ? 1 : input.frequency === "quarterly" ? 3 : 12;
  const start = parseDate(input.startDate);
  const scheduleEndDate = parseDate(scheduleEnd);
  let occurrence = start;
  let occurrenceIndex = 0;
  let count = 0;
  while (true) {
    if (occurrence > scheduleEndDate) break;
    const occurrenceDate = formatDate(occurrence);
    if (occurrenceDate >= input.periodStart) count += 1;
    if (occurrence >= scheduleEndDate) break;
    occurrenceIndex += 1;
    occurrence = addMonths(start, occurrenceIndex * step);
  }
  return count;
}
