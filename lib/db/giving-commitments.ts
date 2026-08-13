import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db/client";
import {
  givingCommitments,
  givingDesignations,
  givingRecipients,
  transactions,
} from "@/db/schema";
import { countCommitmentOccurrences } from "@/lib/giving-commitments";
import * as givingRecipientsService from "./giving-recipients";
import {
  dateStringSchema,
  givingCommitmentCreateSchema,
  givingCommitmentUpdateSchema,
  idSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./validation";

export type CreateInput = z.input<typeof givingCommitmentCreateSchema>;
export type UpdateInput = z.input<typeof givingCommitmentUpdateSchema>;
export class CommitmentTargetError extends Error {}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function assertNoActiveTarget(
  userId: string,
  workspaceId: string,
  recipientId: string,
  designationId: string | null,
  exceptId?: string,
) {
  const rows = await db
    .select({ id: givingCommitments.id, designationId: givingCommitments.designationId })
    .from(givingCommitments)
    .where(
      and(
        eq(givingCommitments.userId, userId),
        eq(givingCommitments.workspaceId, workspaceId),
        eq(givingCommitments.recipientId, recipientId),
        eq(givingCommitments.isActive, true),
      ),
    );
  if (rows.some((row) => row.id !== exceptId && row.designationId === designationId)) {
    throw new CommitmentTargetError(
      "An active commitment already covers this recipient and fund",
    );
  }
}

export async function list(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  return db
    .select({
      id: givingCommitments.id,
      recipientId: givingCommitments.recipientId,
      recipientName: givingRecipients.name,
      designationId: givingCommitments.designationId,
      designationName: givingDesignations.name,
      name: givingCommitments.name,
      amount: givingCommitments.amount,
      frequency: givingCommitments.frequency,
      startDate: givingCommitments.startDate,
      endDate: givingCommitments.endDate,
      notes: givingCommitments.notes,
      isActive: givingCommitments.isActive,
    })
    .from(givingCommitments)
    .innerJoin(givingRecipients, eq(givingCommitments.recipientId, givingRecipients.id))
    .leftJoin(givingDesignations, eq(givingCommitments.designationId, givingDesignations.id))
    .where(
      and(
        eq(givingCommitments.userId, userId),
        eq(givingCommitments.workspaceId, workspaceId),
      ),
    )
    .orderBy(asc(givingRecipients.name), asc(givingCommitments.name));
}

export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const valid = givingCommitmentCreateSchema.parse(input);
  await givingRecipientsService.assertRecipientInWorkspace(userId, workspaceId, valid.recipientId);
  if (valid.designationId) {
    await givingRecipientsService.assertDesignationInWorkspace(
      userId,
      workspaceId,
      valid.designationId,
      valid.recipientId,
    );
  }
  await assertNoActiveTarget(
    userId,
    workspaceId,
    valid.recipientId,
    valid.designationId ?? null,
  );
  const now = new Date();
  const [row] = await db
    .insert(givingCommitments)
    .values({
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      recipientId: valid.recipientId,
      designationId: valid.designationId ?? null,
      name: valid.name,
      amount: String(valid.amount),
      frequency: valid.frequency,
      startDate: valid.startDate,
      endDate: valid.endDate ?? null,
      notes: valid.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function update(
  userId: string,
  workspaceId: string,
  id: string,
  input: UpdateInput,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const valid = givingCommitmentUpdateSchema.parse(input);
  const [existing] = await db
    .select()
    .from(givingCommitments)
    .where(
      and(
        eq(givingCommitments.id, id),
        eq(givingCommitments.userId, userId),
        eq(givingCommitments.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Giving commitment not found or unauthorized");

  const designationId =
    valid.designationId === undefined ? existing.designationId : valid.designationId;
  if (designationId) {
    await givingRecipientsService.assertDesignationInWorkspace(
      userId,
      workspaceId,
      designationId,
      existing.recipientId,
    );
  }
  givingCommitmentCreateSchema.parse({
    recipientId: existing.recipientId,
    designationId,
    name: valid.name ?? existing.name,
    amount: valid.amount ?? Number(existing.amount),
    frequency: valid.frequency ?? existing.frequency,
    startDate: valid.startDate ?? existing.startDate,
    endDate: valid.endDate === undefined ? existing.endDate : valid.endDate,
    notes: valid.notes === undefined ? existing.notes : valid.notes,
  });
  if ((valid.isActive ?? existing.isActive) === true) {
    await assertNoActiveTarget(
      userId,
      workspaceId,
      existing.recipientId,
      designationId,
      existing.id,
    );
  }

  const [row] = await db
    .update(givingCommitments)
    .set({
      ...(valid.designationId !== undefined && { designationId: valid.designationId }),
      ...(valid.name !== undefined && { name: valid.name }),
      ...(valid.amount !== undefined && { amount: String(valid.amount) }),
      ...(valid.frequency !== undefined && { frequency: valid.frequency }),
      ...(valid.startDate !== undefined && { startDate: valid.startDate }),
      ...(valid.endDate !== undefined && { endDate: valid.endDate }),
      ...(valid.notes !== undefined && { notes: valid.notes || null }),
      ...(valid.isActive !== undefined && { isActive: valid.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(givingCommitments.id, id))
    .returning();
  return row;
}

export async function getProgress(
  userId: string,
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
) {
  dateStringSchema.parse(periodStart);
  dateStringSchema.parse(periodEnd);
  if (periodEnd < periodStart) throw new Error("period end must not be before period start");
  const [commitments, gifts, incomeRows] = await Promise.all([
    list(userId, workspaceId),
    db
      .select({
        recipientId: transactions.givingRecipientId,
        designationId: transactions.givingDesignationId,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.workspaceId, workspaceId),
          eq(transactions.type, "giving"),
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
        ),
      ),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.workspaceId, workspaceId),
          eq(transactions.type, "income"),
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
        ),
      ),
  ]);

  const rows = commitments.map((commitment) => {
    const occurrences = countCommitmentOccurrences({
      frequency: commitment.frequency,
      startDate: commitment.startDate,
      endDate: commitment.endDate,
      periodStart,
      periodEnd,
    });
    const expected = roundCurrency(Number(commitment.amount) * occurrences);
    const recorded = roundCurrency(gifts
      .filter(
        (gift) =>
          gift.recipientId === commitment.recipientId &&
          gift.designationId === commitment.designationId &&
          gift.date >= commitment.startDate &&
          (!commitment.endDate || gift.date <= commitment.endDate),
      )
      .reduce((sum, gift) => sum + Number(gift.amount), 0));
    return { ...commitment, expected, recorded, variance: roundCurrency(recorded - expected) };
  });
  const activeRows = rows.filter((row) => row.isActive);
  const periodGiving = roundCurrency(
    gifts.reduce((sum, gift) => sum + Number(gift.amount), 0),
  );
  const periodIncome = roundCurrency(Number(incomeRows[0]?.total ?? 0));
  return {
    periodStart,
    periodEnd,
    expected: roundCurrency(activeRows.reduce((sum, row) => sum + row.expected, 0)),
    recorded: roundCurrency(activeRows.reduce((sum, row) => sum + row.recorded, 0)),
    periodGiving,
    periodIncome,
    givingRate:
      periodIncome > 0
        ? Math.round(((periodGiving / periodIncome) * 100 + Number.EPSILON) * 10) / 10
        : null,
    rows,
  };
}
