import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { onboardingStatus, users } from "@/db/schema";
import { userIdSchema, workspaceIdSchema, currencySchema } from "./validation";
import * as workspaceService from "./workspaces";
import * as budgetsService from "./budgets";
import * as transactionsService from "./transactions";

type TransactionType = "expense" | "giving" | "income";

export interface CompleteOnboardingInput {
  currency: string;
  budget?: {
    category: string;
    amount: number;
    period: "monthly" | "quarterly" | "yearly";
    type: TransactionType;
    startDate: string;
    endDate: string;
  } | null;
  transaction?: {
    amount: number;
    date: string;
    type: TransactionType;
    category: string;
    notes?: string | null;
    receiptStorageId?: string | null;
  } | null;
}

export async function getStatus(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const [status] = await db
    .select()
    .from(onboardingStatus)
    .where(
      and(
        eq(onboardingStatus.userId, userId),
        eq(onboardingStatus.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return status ?? null;
}

export async function complete(userId: string, workspaceId: string, input: CompleteOnboardingInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  currencySchema.parse(input.currency);

  await workspaceService.update(userId, workspaceId, { currency: input.currency });

  if (input.budget) {
    await budgetsService.create(userId, workspaceId, input.budget);
  }

  if (input.transaction) {
    await transactionsService.create(userId, workspaceId, input.transaction);
  }

  const now = new Date();

  await db
    .insert(onboardingStatus)
    .values({
      userId,
      workspaceId,
      hasCompleted: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: onboardingStatus.userId,
      set: {
        workspaceId,
        hasCompleted: true,
        updatedAt: now,
      },
    });

  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: now })
    .where(eq(users.id, userId));
}
