import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { goalActivities, goals } from "@/db/schema";
import {
  goalActivityCreateSchema,
  idSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

export interface CreateInput {
  type: "contribution" | "spending";
  amount: number;
  occurredOn: string;
  notes?: string | null;
}

export async function list(
  workspaceId: string,
  goalId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(goalId);

  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(
        eq(goals.id, goalId),
        eq(goals.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!goal) throw new Error("Goal not found or unauthorized");

  return db
    .select()
    .from(goalActivities)
    .where(
      and(
        eq(goalActivities.goalId, goalId),
        eq(goalActivities.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(goalActivities.occurredOn), desc(goalActivities.createdAt));
}

export async function create(
  workspaceId: string,
  goalId: string,
  input: CreateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(goalId);
  const validInput = goalActivityCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);

  return db.transaction(async (tx) => {
    const [goal] = await tx
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.id, goalId),
          eq(goals.workspaceId, workspaceId),
        ),
      )
      .for("update")
      .limit(1);

    if (!goal) throw new Error("Goal not found or unauthorized");
    if (!goal.isActive) throw new Error("Activity cannot be recorded for an inactive goal");

    const currentAmount = Number(goal.currentAmount);
    if (validInput.type === "spending" && validInput.amount > currentAmount) {
      throw new Error("Spending cannot exceed the fund's available amount");
    }
    const nextAmount =
      Math.round(
        (currentAmount +
          (validInput.type === "contribution" ? validInput.amount : -validInput.amount)) *
          100,
      ) / 100;
    const now = new Date();

    const [activity] = await tx
      .insert(goalActivities)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        goalId,
        type: validInput.type,
        amount: String(validInput.amount),
        occurredOn: validInput.occurredOn,
        notes: validInput.notes ?? null,
        createdAt: now,
      })
      .returning();

    await tx
      .update(goals)
      .set({ currentAmount: String(nextAmount), updatedAt: now })
      .where(eq(goals.id, goalId));

    return activity;
  });
}

export async function getSpentByGoal(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);

  const rows = await db
    .select({
      goalId: goalActivities.goalId,
      spent: sql<string>`coalesce(sum(case when ${goalActivities.type} = 'spending' then ${goalActivities.amount} else 0 end), 0)`,
    })
    .from(goalActivities)
    .where(eq(goalActivities.workspaceId, workspaceId))
    .groupBy(goalActivities.goalId);

  return new Map(rows.map((row) => [row.goalId, Number(row.spent)]));
}
