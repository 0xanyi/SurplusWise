import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { outgoingPaymentLogs, recurringOutgoings } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  outgoingPaymentLogCreateSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateInput {
  amount: number;
  paidAt: string;
  periodMonth: string; // YYYY-MM-01
  notes?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List payment logs for a specific outgoing, newest first. */
export async function listForOutgoing(userId: string, outgoingId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);

  // Verify ownership
  const [outgoing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.id, outgoingId),
        eq(recurringOutgoings.userId, userId),
      ),
    )
    .limit(1);

  if (!outgoing) throw new Error("Recurring outgoing not found or unauthorized");

  return db
    .select()
    .from(outgoingPaymentLogs)
    .where(eq(outgoingPaymentLogs.outgoingId, outgoingId))
    .orderBy(desc(outgoingPaymentLogs.paidAt));
}

/**
 * Get payment status for all active outgoings for a specific month.
 * Returns which outgoings have been paid and which are still pending.
 */
export async function getMonthlyStatus(userId: string, periodMonth: string) {
  userIdSchema.parse(userId);

  const payments = await db
    .select({
      outgoingId: outgoingPaymentLogs.outgoingId,
      amount: outgoingPaymentLogs.amount,
      paidAt: outgoingPaymentLogs.paidAt,
      id: outgoingPaymentLogs.id,
    })
    .from(outgoingPaymentLogs)
    .where(
      and(
        eq(outgoingPaymentLogs.userId, userId),
        eq(outgoingPaymentLogs.periodMonth, periodMonth),
      ),
    );

  // Map outgoingId -> payment info
  const paymentMap = new Map<string, { id: string; amount: number; paidAt: string }>();
  for (const p of payments) {
    paymentMap.set(p.outgoingId, {
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt,
    });
  }

  return paymentMap;
}

/** Log a payment for a recurring outgoing. */
export async function create(
  userId: string,
  outgoingId: string,
  input: CreateInput,
) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);
  outgoingPaymentLogCreateSchema.parse(input);

  // Verify ownership
  const [outgoing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.id, outgoingId),
        eq(recurringOutgoings.userId, userId),
      ),
    )
    .limit(1);

  if (!outgoing) throw new Error("Recurring outgoing not found or unauthorized");

  const id = genId();
  const now = new Date();

  const [row] = await db
    .insert(outgoingPaymentLogs)
    .values({
      id,
      outgoingId,
      userId,
      amount: String(input.amount),
      paidAt: input.paidAt,
      periodMonth: input.periodMonth,
      notes: input.notes ?? null,
      createdAt: now,
    })
    .returning();

  return row;
}

/** Delete a payment log. */
export async function remove(userId: string, outgoingId: string, logId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);
  idSchema.parse(logId);

  const [existing] = await db
    .select({ id: outgoingPaymentLogs.id })
    .from(outgoingPaymentLogs)
    .where(
      and(
        eq(outgoingPaymentLogs.id, logId),
        eq(outgoingPaymentLogs.outgoingId, outgoingId),
        eq(outgoingPaymentLogs.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Payment log not found or unauthorized");

  await db
    .delete(outgoingPaymentLogs)
    .where(
      and(
        eq(outgoingPaymentLogs.id, logId),
        eq(outgoingPaymentLogs.outgoingId, outgoingId),
        eq(outgoingPaymentLogs.userId, userId),
      ),
    );
}
