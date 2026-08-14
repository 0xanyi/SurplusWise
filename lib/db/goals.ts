import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { goals } from "@/db/schema";
import { goalCreateSchema, goalUpdateSchema, idSchema, userIdSchema, workspaceIdSchema } from "./validation";

export type GoalCategory =
  | "emergency_fund"
  | "savings"
  | "debt_payoff"
  | "giving"
  | "travel"
  | "home"
  | "education"
  | "business"
  | "other";

export interface CreateInput {
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  category?: GoalCategory;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

function genId() {
  return crypto.randomUUID();
}

export async function list(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  return db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.workspaceId, workspaceId)));
}

export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const validInput = goalCreateSchema.parse(input);
  const now = new Date();

  const [row] = await db
    .insert(goals)
    .values({
      id: genId(),
      userId,
      workspaceId,
      name: validInput.name,
      category: validInput.category,
      targetAmount: String(validInput.targetAmount),
      currentAmount: String(validInput.currentAmount ?? 0),
      targetDate: validInput.targetDate ?? null,
      notes: validInput.notes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const validInput = goalUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Goal not found or unauthorized");

  const [row] = await db
    .update(goals)
    .set({
      ...(validInput.name !== undefined && { name: validInput.name }),
      ...(validInput.category !== undefined && { category: validInput.category }),
      ...(validInput.targetAmount !== undefined && { targetAmount: String(validInput.targetAmount) }),
      ...(validInput.currentAmount !== undefined && { currentAmount: String(validInput.currentAmount) }),
      ...(validInput.targetDate !== undefined && { targetDate: validInput.targetDate }),
      ...(validInput.notes !== undefined && { notes: validInput.notes }),
      ...(validInput.isActive !== undefined && { isActive: validInput.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();

  return row;
}

export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Goal not found or unauthorized");

  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}
