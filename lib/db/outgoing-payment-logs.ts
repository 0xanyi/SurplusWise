import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { outgoingPaymentLogs, recurringOutgoings } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  outgoingPaymentLogCreateSchema,
  workspaceIdSchema,
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
export async function listForOutgoing(
  userId: string,
  outgoingId: string,
  workspaceId?: string,
) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);
  if (workspaceId) workspaceIdSchema.parse(workspaceId);

  // Verify ownership
  const ownership = [
    eq(recurringOutgoings.id, outgoingId),
    eq(recurringOutgoings.userId, userId),
    eq(recurringOutgoings.type, "expense"),
  ];
  if (workspaceId) ownership.push(eq(recurringOutgoings.workspaceId, workspaceId));
  const [outgoing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(and(...ownership))
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
export async function getMonthlyStatus(
  userId: string,
  periodMonth: string,
  workspaceId?: string,
) {
  userIdSchema.parse(userId);
  if (workspaceId) workspaceIdSchema.parse(workspaceId);

  const conditions = [
    eq(outgoingPaymentLogs.userId, userId),
    eq(outgoingPaymentLogs.periodMonth, periodMonth),
    eq(recurringOutgoings.type, "expense"),
  ];
  if (workspaceId) conditions.push(eq(recurringOutgoings.workspaceId, workspaceId));

  const payments = await db
    .select({
      outgoingId: outgoingPaymentLogs.outgoingId,
      amount: outgoingPaymentLogs.amount,
      paidAt: outgoingPaymentLogs.paidAt,
      id: outgoingPaymentLogs.id,
    })
    .from(outgoingPaymentLogs)
    .innerJoin(recurringOutgoings, eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id))
    .where(and(...conditions));

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
  workspaceId?: string,
) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);
  if (workspaceId) workspaceIdSchema.parse(workspaceId);
  outgoingPaymentLogCreateSchema.parse(input);

  const ownership = [
    eq(recurringOutgoings.id, outgoingId),
    eq(recurringOutgoings.userId, userId),
    eq(recurringOutgoings.type, "expense"),
  ];
  if (workspaceId) ownership.push(eq(recurringOutgoings.workspaceId, workspaceId));

  return db.transaction(async (tx) => {
    const [outgoing] = await tx
      .select({ id: recurringOutgoings.id })
      .from(recurringOutgoings)
      .where(and(...ownership))
      .limit(1)
      .for("update");

    if (!outgoing) throw new Error("Recurring outgoing not found or unauthorized");

    const [row] = await tx
      .insert(outgoingPaymentLogs)
      .values({
        id: genId(),
        outgoingId,
        userId,
        amount: String(input.amount),
        paidAt: input.paidAt,
        periodMonth: input.periodMonth,
        notes: input.notes ?? null,
        createdAt: new Date(),
      })
      .returning();
    return row;
  });
}

/** Delete a payment log. */
export async function remove(
  userId: string,
  outgoingId: string,
  logId: string,
  workspaceId?: string,
) {
  userIdSchema.parse(userId);
  idSchema.parse(outgoingId);
  idSchema.parse(logId);
  if (workspaceId) workspaceIdSchema.parse(workspaceId);

  const ownership = [
    eq(recurringOutgoings.id, outgoingId),
    eq(recurringOutgoings.userId, userId),
    eq(recurringOutgoings.type, "expense"),
  ];
  if (workspaceId) ownership.push(eq(recurringOutgoings.workspaceId, workspaceId));
  const [outgoing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(and(...ownership))
    .limit(1);
  if (!outgoing) throw new Error("Recurring outgoing not found or unauthorized");

  const deletion = and(
    eq(outgoingPaymentLogs.id, logId),
    eq(outgoingPaymentLogs.outgoingId, outgoingId),
    eq(outgoingPaymentLogs.userId, userId),
  );
  const [existing] = await db
    .select({ id: outgoingPaymentLogs.id })
    .from(outgoingPaymentLogs)
    .where(deletion)
    .limit(1);
  if (!existing) throw new Error("Payment log not found or unauthorized");
  await db.delete(outgoingPaymentLogs).where(deletion);
}
