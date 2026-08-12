import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { debtsCredits, debtStatements, debtPayments } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  workspaceIdSchema,
  debtStatementCreateSchema,
  debtStatementUpdateSchema,
  debtPaymentCreateSchema,
} from "./validation";
import {
  deriveRate,
  deriveBucketRate,
  forecastMinimumPayment,
  getPaymentWindowStart,
  getRateVariance,
  getStatementResidual,
  isResidualSignificant,
  isRevolvingDebt,
  normaliseInterestBreakdown,
  sumInterestBreakdown,
  type InterestBucket,
} from "@/lib/debt-interest";
import { syncCurrentBalance } from "./debts-credits";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StatementInput {
  periodStart: string;
  periodEnd: string;
  statementDate: string;
  dueDate?: string | null;
  openingBalance: number;
  closingBalance: number;
  interestCharged?: number;
  feesCharged?: number;
  newSpending?: number | null;
  minimumPayment?: number | null;
  balanceSubjectToInterest?: number | null;
  interestBreakdown?: InterestBucket[] | null;
  principalPaid?: number | null;
  interestPaid?: number | null;
  notes?: string | null;
}

export type StatementUpdateInput = Partial<StatementInput>;

export interface PaymentInput {
  amount: number;
  paidAt: string;
  notes?: string | null;
}

/** A stored bucket enriched with the rate it implies for the statement period. */
export interface EnrichedInterestBucket extends InterestBucket {
  label: string | null;
  apr: number | null;
  rate: ReturnType<typeof deriveBucketRate>;
  rateVariance: number | null;
}

function genId() {
  return crypto.randomUUID();
}

function num(value: string | null): number | null {
  return value == null ? null : Number(value);
}

/** Verify the debt belongs to the user, returning the fields callers need. */
async function assertOwnership(userId: string, debtId: string) {
  const [debt] = await db
    .select({
      id: debtsCredits.id,
      interestRate: debtsCredits.interestRate,
      minPaymentPercent: debtsCredits.minPaymentPercent,
      minPaymentFloor: debtsCredits.minPaymentFloor,
    })
    .from(debtsCredits)
    .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)))
    .limit(1);

  if (!debt) throw new Error("Debt/credit not found or unauthorized");
  return debt;
}

// ─── Statements ──────────────────────────────────────────────────────────────

/**
 * List statements newest-first, each enriched with its derived rate and the
 * residual between its recorded figures and its closing balance.
 */
export async function listStatements(userId: string, debtId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  const debt = await assertOwnership(userId, debtId);

  const rows = await db
    .select()
    .from(debtStatements)
    .where(and(eq(debtStatements.debtId, debtId), eq(debtStatements.userId, userId)))
    .orderBy(desc(debtStatements.periodEnd));

  const payments = await db
    .select({ amount: debtPayments.amount, paidAt: debtPayments.paidAt })
    .from(debtPayments)
    .where(and(eq(debtPayments.debtId, debtId), eq(debtPayments.userId, userId)));

  return rows.map((row) => {
    const openingBalance = Number(row.openingBalance);
    const closingBalance = Number(row.closingBalance);
    const interestCharged = Number(row.interestCharged);
    const feesCharged = Number(row.feesCharged);

    const paymentsInPeriod = payments
      .filter((p) => p.paidAt >= row.periodStart && p.paidAt <= row.periodEnd)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const rate = deriveRate({
      openingBalance,
      closingBalance,
      interestCharged,
      balanceSubjectToInterest: num(row.balanceSubjectToInterest),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
    });

    const residual = getStatementResidual({
      openingBalance,
      closingBalance,
      interestCharged,
      feesCharged,
      newSpending: num(row.newSpending),
      paymentsInPeriod,
    });

    const interestBreakdown: EnrichedInterestBucket[] | null =
      row.interestBreakdown?.map((bucket) => {
        const bucketRate = deriveBucketRate(bucket, row.periodStart, row.periodEnd);
        return {
          ...bucket,
          label: bucket.label ?? null,
          apr: bucket.apr ?? null,
          rate: bucketRate,
          rateVariance: getRateVariance(bucketRate, bucket.apr),
        };
      }) ?? null;

    return {
      ...row,
      openingBalance,
      closingBalance,
      interestCharged,
      feesCharged,
      newSpending: num(row.newSpending),
      minimumPayment: num(row.minimumPayment),
      balanceSubjectToInterest: num(row.balanceSubjectToInterest),
      interestBreakdown,
      principalPaid: num(row.principalPaid),
      interestPaid: num(row.interestPaid),
      paymentsInPeriod,
      rate,
      advertisedApr: num(debt.interestRate),
      residual,
      residualSignificant: isResidualSignificant(residual, closingBalance),
    };
  });
}

/**
 * Values to prefill a new statement from the previous one, so closing a cycle
 * asks for three numbers rather than ten.
 */
export async function getStatementDraft(userId: string, debtId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  const debt = await assertOwnership(userId, debtId);

  const [previous] = await db
    .select()
    .from(debtStatements)
    .where(and(eq(debtStatements.debtId, debtId), eq(debtStatements.userId, userId)))
    .orderBy(desc(debtStatements.periodEnd))
    .limit(1);

  const [current] = await db
    .select({ currentBalance: debtsCredits.currentBalance })
    .from(debtsCredits)
    .where(eq(debtsCredits.id, debtId))
    .limit(1);

  if (!previous) {
    return {
      periodStart: null,
      openingBalance: Number(current?.currentBalance ?? 0),
      suggestedMinimum: null,
      hasPrevious: false,
    };
  }

  const openingBalance = Number(previous.closingBalance);
  const dayAfter = new Date(`${previous.periodEnd}T00:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  return {
    periodStart: dayAfter.toISOString().slice(0, 10),
    openingBalance,
    suggestedMinimum: forecastMinimumPayment(
      openingBalance,
      Number(previous.interestCharged),
      Number(previous.feesCharged),
      {
        percent: num(debt.minPaymentPercent),
        floor: num(debt.minPaymentFloor),
      },
    ),
    hasPrevious: true,
  };
}

export async function createStatement(userId: string, debtId: string, input: StatementInput) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  const parsed = debtStatementCreateSchema.parse(input);
  await assertOwnership(userId, debtId);

  // When a split is supplied the buckets are the source of truth: statement
  // totals are their sums, whatever the client sent.
  const breakdown = normaliseInterestBreakdown(parsed.interestBreakdown);
  const sums = breakdown ? sumInterestBreakdown(breakdown) : null;

  const now = new Date();
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(debtStatements)
      .values({
        id: genId(),
        debtId,
        userId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        statementDate: parsed.statementDate,
        dueDate: parsed.dueDate ?? null,
        openingBalance: String(parsed.openingBalance),
        closingBalance: String(parsed.closingBalance),
        interestCharged: String(sums?.interestCharged ?? parsed.interestCharged),
        feesCharged: String(parsed.feesCharged),
        newSpending: parsed.newSpending != null ? String(parsed.newSpending) : null,
        minimumPayment: parsed.minimumPayment != null ? String(parsed.minimumPayment) : null,
        balanceSubjectToInterest:
          sums != null
            ? String(sums.balanceSubjectToInterest)
            : parsed.balanceSubjectToInterest != null
              ? String(parsed.balanceSubjectToInterest)
              : null,
        interestBreakdown: breakdown,
        principalPaid: parsed.principalPaid != null ? String(parsed.principalPaid) : null,
        interestPaid: parsed.interestPaid != null ? String(parsed.interestPaid) : null,
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await syncCurrentBalance(tx, userId, debtId);
    return inserted;
  });
}

export async function updateStatement(
  userId: string,
  debtId: string,
  statementId: string,
  input: StatementUpdateInput,
) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  idSchema.parse(statementId);
  const parsed = debtStatementUpdateSchema.parse(input);
  await assertOwnership(userId, debtId);

  const [existing] = await db
    .select({
      id: debtStatements.id,
      periodStart: debtStatements.periodStart,
      periodEnd: debtStatements.periodEnd,
    })
    .from(debtStatements)
    .where(
      and(
        eq(debtStatements.id, statementId),
        eq(debtStatements.debtId, debtId),
        eq(debtStatements.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Statement not found or unauthorized");

  // The check constraint only sees the final row, so validate the merged period.
  const periodStart = parsed.periodStart ?? existing.periodStart;
  const periodEnd = parsed.periodEnd ?? existing.periodEnd;
  if (periodEnd < periodStart) {
    throw new Error("period end must not be before period start");
  }

  // A provided breakdown replaces the whole split; null or [] clears it. When
  // a split is supplied its sums win over any totals in the same patch.
  const breakdownProvided = parsed.interestBreakdown !== undefined;
  const breakdown = breakdownProvided
    ? normaliseInterestBreakdown(parsed.interestBreakdown)
    : undefined;
  const sums = breakdown ? sumInterestBreakdown(breakdown) : null;

  const str = (v: number | null | undefined) => (v != null ? String(v) : null);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(debtStatements)
      .set({
        ...(parsed.periodStart !== undefined && { periodStart: parsed.periodStart }),
        ...(parsed.periodEnd !== undefined && { periodEnd: parsed.periodEnd }),
        ...(parsed.statementDate !== undefined && { statementDate: parsed.statementDate }),
        ...(parsed.dueDate !== undefined && { dueDate: parsed.dueDate ?? null }),
        ...(parsed.openingBalance !== undefined && {
          openingBalance: String(parsed.openingBalance),
        }),
        ...(parsed.closingBalance !== undefined && {
          closingBalance: String(parsed.closingBalance),
        }),
        ...(parsed.interestCharged !== undefined && {
          interestCharged: String(parsed.interestCharged),
        }),
        ...(parsed.feesCharged !== undefined && { feesCharged: String(parsed.feesCharged) }),
        ...(parsed.newSpending !== undefined && { newSpending: str(parsed.newSpending) }),
        ...(parsed.minimumPayment !== undefined && {
          minimumPayment: str(parsed.minimumPayment),
        }),
        ...(parsed.balanceSubjectToInterest !== undefined && {
          balanceSubjectToInterest: str(parsed.balanceSubjectToInterest),
        }),
        // After the plain totals so bucket sums win when both are patched.
        ...(breakdownProvided && { interestBreakdown: breakdown ?? null }),
        ...(sums != null && { interestCharged: String(sums.interestCharged) }),
        ...(sums != null && {
          balanceSubjectToInterest: String(sums.balanceSubjectToInterest),
        }),
        ...(parsed.principalPaid !== undefined && { principalPaid: str(parsed.principalPaid) }),
        ...(parsed.interestPaid !== undefined && { interestPaid: str(parsed.interestPaid) }),
        ...(parsed.notes !== undefined && { notes: parsed.notes ?? null }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(debtStatements.id, statementId),
          eq(debtStatements.debtId, debtId),
          eq(debtStatements.userId, userId),
        ),
      )
      .returning();

    await syncCurrentBalance(tx, userId, debtId);
    return row;
  });
}

export async function removeStatement(userId: string, debtId: string, statementId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  idSchema.parse(statementId);
  await assertOwnership(userId, debtId);

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(debtStatements)
      .where(
        and(
          eq(debtStatements.id, statementId),
          eq(debtStatements.debtId, debtId),
          eq(debtStatements.userId, userId),
        ),
      )
      .returning({ id: debtStatements.id });

    if (deleted.length === 0) throw new Error("Statement not found or unauthorized");

    await syncCurrentBalance(tx, userId, debtId);
  });
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function listPayments(userId: string, debtId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  await assertOwnership(userId, debtId);

  const rows = await db
    .select()
    .from(debtPayments)
    .where(and(eq(debtPayments.debtId, debtId), eq(debtPayments.userId, userId)))
    .orderBy(desc(debtPayments.paidAt), desc(debtPayments.createdAt));

  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export async function createPayment(userId: string, debtId: string, input: PaymentInput) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  const parsed = debtPaymentCreateSchema.parse(input);
  await assertOwnership(userId, debtId);

  const [row] = await db
    .insert(debtPayments)
    .values({
      id: genId(),
      debtId,
      userId,
      amount: String(parsed.amount),
      paidAt: parsed.paidAt,
      notes: parsed.notes ?? null,
      createdAt: new Date(),
    })
    .returning();

  return row;
}

export async function removePayment(userId: string, debtId: string, paymentId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  idSchema.parse(paymentId);
  await assertOwnership(userId, debtId);

  const deleted = await db
    .delete(debtPayments)
    .where(
      and(
        eq(debtPayments.id, paymentId),
        eq(debtPayments.debtId, debtId),
        eq(debtPayments.userId, userId),
      ),
    )
    .returning({ id: debtPayments.id });

  if (deleted.length === 0) throw new Error("Payment not found or unauthorized");
}

// ─── Cross-debt reporting ────────────────────────────────────────────────────

/**
 * Total interest and fees charged across a workspace in a date range.
 *
 * This is deliberately NOT added to expense totals. Sika counts the cash that
 * leaves your bank (the debt payment) as the expense; interest is already
 * inside that figure. Reporting it as a second expense line would double-count
 * it. It is a cost-of-borrowing metric, reported on its own.
 */
export async function getCostOfBorrowing(
  userId: string,
  workspaceId: string,
  range: { startDate: string; endDate: string },
) {
  userIdSchema.parse(userId);

  const [result] = await db
    .select({
      interest: sql<string>`coalesce(sum(${debtStatements.interestCharged}), 0)`,
      fees: sql<string>`coalesce(sum(${debtStatements.feesCharged}), 0)`,
      statements: sql<number>`count(*)`,
    })
    .from(debtStatements)
    .innerJoin(debtsCredits, eq(debtStatements.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtStatements.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtStatements.periodEnd, range.startDate),
        lte(debtStatements.periodEnd, range.endDate),
      ),
    );

  return {
    interest: Number(result?.interest ?? 0),
    fees: Number(result?.fees ?? 0),
    total: Number(result?.interest ?? 0) + Number(result?.fees ?? 0),
    statements: Number(result?.statements ?? 0),
  };
}

/**
 * The next payment due for each active debt in a workspace.
 *
 * Prefers the latest statement's due date and actual minimum. Falls back to the
 * debt's `payment_day_of_month` and a forecast minimum, so a debt that has never
 * had a statement recorded still surfaces in the due-date views.
 *
 * Also reports how much has been paid towards that amount, because a due date
 * with no notion of settlement would leave every past-due statement reading as
 * overdue forever — recurring outgoings have `payment_status.paid` for exactly
 * this reason.
 */
export async function listUpcomingDebtPayments(
  userId: string,
  workspaceId: string,
  reference: Date = new Date(),
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const debts = await db
    .select({
      id: debtsCredits.id,
      name: debtsCredits.name,
      debtType: debtsCredits.debtType,
      currentBalance: debtsCredits.currentBalance,
      minimumPayment: debtsCredits.minimumPayment,
      minPaymentPercent: debtsCredits.minPaymentPercent,
      minPaymentFloor: debtsCredits.minPaymentFloor,
      paymentDayOfMonth: debtsCredits.paymentDayOfMonth,
    })
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        eq(debtsCredits.isActive, true),
      ),
    )
    .orderBy(asc(debtsCredits.name));

  if (debts.length === 0) return [];

  const latestStatements = await db
    .selectDistinctOn([debtStatements.debtId], {
      debtId: debtStatements.debtId,
      periodEnd: debtStatements.periodEnd,
      dueDate: debtStatements.dueDate,
      minimumPayment: debtStatements.minimumPayment,
      closingBalance: debtStatements.closingBalance,
      interestCharged: debtStatements.interestCharged,
      feesCharged: debtStatements.feesCharged,
    })
    .from(debtStatements)
    .where(eq(debtStatements.userId, userId))
    .orderBy(desc(debtStatements.debtId), desc(debtStatements.periodEnd));

  const byDebt = new Map(latestStatements.map((s) => [s.debtId, s]));

  // Each debt counts payments from its own window, but one query covers them
  // all: fetch from the earliest window start and bucket in memory.
  const windowStarts = new Map(
    debts.map((debt) => [
      debt.id,
      getPaymentWindowStart(byDebt.get(debt.id)?.periodEnd ?? null, reference),
    ]),
  );
  const earliestWindow = [...windowStarts.values()].sort()[0];

  const paymentRows = await db
    .select({ debtId: debtPayments.debtId, amount: debtPayments.amount, paidAt: debtPayments.paidAt })
    .from(debtPayments)
    .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtPayments.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtPayments.paidAt, earliestWindow),
      ),
    );

  const paidByDebt = new Map<string, number>();
  for (const row of paymentRows) {
    const windowStart = windowStarts.get(row.debtId);
    if (!windowStart || row.paidAt < windowStart) continue;
    paidByDebt.set(row.debtId, (paidByDebt.get(row.debtId) ?? 0) + Number(row.amount));
  }

  return debts.map((debt) => {
    const statement = byDebt.get(debt.id);
    const balance = Number(debt.currentBalance);

    // Only revolving debt has a percentage-of-balance minimum. A mortgage's
    // instalment is set by its agreement, and 1% of the balance is not it.
    const forecast = isRevolvingDebt(debt.debtType)
      ? forecastMinimumPayment(
          balance,
          Number(statement?.interestCharged ?? 0),
          Number(statement?.feesCharged ?? 0),
          { percent: num(debt.minPaymentPercent), floor: num(debt.minPaymentFloor) },
        )
      : null;

    const statementMinimum = statement ? num(statement.minimumPayment) : null;
    const configuredMinimum = num(debt.minimumPayment);
    const amount = statementMinimum ?? configuredMinimum ?? forecast;
    const paidTowardsNext = paidByDebt.get(debt.id) ?? 0;

    return {
      id: debt.id,
      name: debt.name,
      debtType: debt.debtType,
      currentBalance: balance,
      dueDate: statement?.dueDate ?? null,
      paymentDayOfMonth: debt.paymentDayOfMonth,
      amount,
      /**
       * True when `amount` is a figure someone stated — off a statement, or
       * typed into the debt. Only the CONC forecast is our own estimate, and
       * only it should be labelled as one.
       */
      amountIsActual: statementMinimum != null || configuredMinimum != null,
      /** Paid since the last statement closed, or this month when there is none. */
      paidTowardsNext,
      /** Nothing further is owed right now, so the due-date panels can drop it. */
      settled: amount != null && paidTowardsNext >= amount,
    };
  });
}
