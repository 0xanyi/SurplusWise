import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { outgoingPaymentLogs, recurringOutgoings } from "@/db/schema";
import {
  idSchema,
  outgoingPaymentLogCreateSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

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

async function assertOutgoingInWorkspace(workspaceId: string, outgoingId: string) {
  const [outgoing] = await db
    .select({ id: recurringOutgoings.id })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.id, outgoingId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
      ),
    )
    .limit(1);

  if (!outgoing) throw new Error("Recurring outgoing not found or unauthorized");
  return outgoing;
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List payment logs for a specific outgoing, newest first. */
export async function listForOutgoing(workspaceId: string, outgoingId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(outgoingId);

  await assertOutgoingInWorkspace(workspaceId, outgoingId);

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
export async function getMonthlyStatus(workspaceId: string, periodMonth: string) {
  workspaceIdSchema.parse(workspaceId);

  const payments = await db
    .select({
      outgoingId: outgoingPaymentLogs.outgoingId,
      amount: outgoingPaymentLogs.amount,
      paidAt: outgoingPaymentLogs.paidAt,
      id: outgoingPaymentLogs.id,
    })
    .from(outgoingPaymentLogs)
    .innerJoin(recurringOutgoings, eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id))
    .where(
      and(
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(outgoingPaymentLogs.periodMonth, periodMonth),
        eq(recurringOutgoings.type, "expense"),
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
  workspaceId: string,
  outgoingId: string,
  input: CreateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(outgoingId);
  outgoingPaymentLogCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);

  const ownership = [
    eq(recurringOutgoings.id, outgoingId),
    eq(recurringOutgoings.workspaceId, workspaceId),
    eq(recurringOutgoings.type, "expense"),
  ];

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
  workspaceId: string,
  outgoingId: string,
  logId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(outgoingId);
  idSchema.parse(logId);

  await assertOutgoingInWorkspace(workspaceId, outgoingId);

  const deletion = and(
    eq(outgoingPaymentLogs.id, logId),
    eq(outgoingPaymentLogs.outgoingId, outgoingId),
  );
  const [existing] = await db
    .select({ id: outgoingPaymentLogs.id })
    .from(outgoingPaymentLogs)
    .where(deletion)
    .limit(1);
  if (!existing) throw new Error("Payment log not found or unauthorized");
  await db.delete(outgoingPaymentLogs).where(deletion);
}
