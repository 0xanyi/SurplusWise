import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDaysUntilDue,
  getDueUrgency,
  getEffectiveDueDate,
  getNextDueDate,
} from "./outgoings-date";

const urgencyOf = (dayOfMonth: number, isPaid: boolean, now: Date) =>
  getDueUrgency(getDaysUntilDue(getEffectiveDueDate(dayOfMonth, isPaid, now), now));

test("an unpaid bill whose day has passed reads as overdue, not next month", () => {
  const now = new Date(2026, 7, 9); // 9 August
  const due = getEffectiveDueDate(7, false, now);

  assert.equal(due.getMonth(), 7, "should stay in August");
  assert.equal(due.getDate(), 7);
  assert.equal(getDaysUntilDue(due, now), -2);
  assert.equal(urgencyOf(7, false, now), "overdue");
});

test("the forward-looking helper is what made overdue unreachable", () => {
  // Regression guard: composing getNextDueDate with getDueUrgency can never
  // produce "overdue", which is why getEffectiveDueDate exists.
  const now = new Date(2026, 7, 9);
  const next = getNextDueDate(7, now);

  assert.equal(next.getMonth(), 8, "getNextDueDate rolls to September");
  assert.ok(getDaysUntilDue(next, now) > 0);
});

test("a paid bill looks ahead to the next cycle", () => {
  const now = new Date(2026, 7, 9);
  const due = getEffectiveDueDate(7, true, now);

  assert.equal(due.getMonth(), 8, "paid bills roll forward");
  assert.ok(getDaysUntilDue(due, now) > 0);
});

test("urgency bands either side of today", () => {
  const now = new Date(2026, 7, 9);

  assert.equal(urgencyOf(9, false, now), "today");
  assert.equal(urgencyOf(10, false, now), "soon"); // +1
  assert.equal(urgencyOf(12, false, now), "soon"); // +3
  assert.equal(urgencyOf(13, false, now), "upcoming"); // +4
  assert.equal(urgencyOf(16, false, now), "upcoming"); // +7
  assert.equal(urgencyOf(17, false, now), "future"); // +8
});

test("the attention and coming-up panels partition every bill exactly once", () => {
  const now = new Date(2026, 7, 9);

  for (let day = 1; day <= 28; day++) {
    const days = getDaysUntilDue(getEffectiveDueDate(day, false, now), now);
    const urgency = getDueUrgency(days);

    // NeedsAttention keeps overdue|today; UpcomingBills keeps days > 0.
    const inAttention = urgency === "overdue" || urgency === "today";
    const inUpcoming = days > 0;

    assert.notEqual(
      inAttention,
      inUpcoming,
      `day ${day} (${urgency}, ${days}d) must land in exactly one panel`,
    );
  }
});

test("a short month clamps the due day rather than overflowing", () => {
  const now = new Date(2026, 1, 10); // 10 February 2026
  const due = getEffectiveDueDate(31, false, now);

  assert.equal(due.getMonth(), 1, "should stay in February");
  assert.equal(due.getDate(), 28, "clamped to the last day");
});
