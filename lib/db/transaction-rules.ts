import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db/client";
import { transactionRules } from "@/db/schema";
import * as clientsService from "./clients";
import { ownerUserId } from "./workspaces";
import {
  idSchema,
  transactionRuleCreateSchema,
  transactionRuleUpdateSchema,
  workspaceIdSchema,
} from "./validation";

export type CreateInput = z.input<typeof transactionRuleCreateSchema>;
export type UpdateInput = z.input<typeof transactionRuleUpdateSchema>;

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export async function list(workspaceId: string, activeOnly = false) {
  workspaceIdSchema.parse(workspaceId);
  const conditions = [
    eq(transactionRules.workspaceId, workspaceId),
  ];
  if (activeOnly) conditions.push(eq(transactionRules.isActive, true));
  return db
    .select()
    .from(transactionRules)
    .where(and(...conditions))
    .orderBy(
      asc(transactionRules.priority),
      asc(transactionRules.createdAt),
      asc(transactionRules.id),
    );
}

export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  const valid = transactionRuleCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  if (valid.clientId) {
    await clientsService.assertInWorkspace(workspaceId, valid.clientId);
  }
  const now = new Date();
  try {
    const [row] = await db
      .insert(transactionRules)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        ...valid,
        transactionType: valid.transactionType ?? null,
        category: valid.category ?? null,
        clientId: valid.clientId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A transaction rule with this name already exists", { cause: error });
    }
    throw error;
  }
}

export async function update(
  workspaceId: string,
  id: string,
  input: UpdateInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const valid = transactionRuleUpdateSchema.parse(input);
  if (valid.clientId) {
    await clientsService.assertInWorkspace(workspaceId, valid.clientId);
  }
  const [existing] = await db
    .select()
    .from(transactionRules)
    .where(
      and(
        eq(transactionRules.id, id),
        eq(transactionRules.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Transaction rule not found or unauthorized");
  transactionRuleCreateSchema.parse({
    name: valid.name ?? existing.name,
    matchField: valid.matchField ?? existing.matchField,
    matchValue: valid.matchValue ?? existing.matchValue,
    transactionType:
      valid.transactionType === undefined ? existing.transactionType : valid.transactionType,
    category: valid.category === undefined ? existing.category : valid.category,
    tags: valid.tags ?? existing.tags,
    clientId: valid.clientId === undefined ? existing.clientId : valid.clientId,
    markReviewed: valid.markReviewed ?? existing.markReviewed,
    isActive: valid.isActive ?? existing.isActive,
    priority: valid.priority ?? existing.priority,
  });
  try {
    const [row] = await db
      .update(transactionRules)
      .set({ ...valid, updatedAt: new Date() })
      .where(
        and(
          eq(transactionRules.id, id),
          eq(transactionRules.workspaceId, workspaceId),
        ),
      )
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A transaction rule with this name already exists", { cause: error });
    }
    throw error;
  }
}

export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const [row] = await db
    .delete(transactionRules)
    .where(
      and(
        eq(transactionRules.id, id),
        eq(transactionRules.workspaceId, workspaceId),
      ),
    )
    .returning({ id: transactionRules.id });
  if (!row) throw new Error("Transaction rule not found or unauthorized");
}

export async function applyToImportRows<
  T extends {
    type: "expense" | "giving" | "income";
    payee: string | null;
    notes: string | null;
    category: string;
    tags: string[];
    clientId?: string | null;
    needsReview?: boolean;
  },
>(workspaceId: string, rows: T[]) {
  const rules = await list(workspaceId, true);
  return rows.map((row) => {
    const rule = rules.find((candidate) => {
      if (candidate.transactionType && candidate.transactionType !== row.type) return false;
      if (
        row.type === "giving" &&
        candidate.clientId &&
        !candidate.category &&
        candidate.tags.length === 0 &&
        !candidate.markReviewed
      ) {
        return false;
      }
      const source = candidate.matchField === "payee" ? row.payee : row.notes;
      return source?.toLowerCase().includes(candidate.matchValue.toLowerCase()) ?? false;
    });
    if (!rule) return { ...row, needsReview: row.needsReview ?? true };
    return {
      ...row,
      ...(rule.category && { category: rule.category }),
      ...(rule.tags.length > 0 && { tags: rule.tags }),
      ...(rule.clientId && row.type !== "giving" && { clientId: rule.clientId }),
      needsReview: rule.markReviewed ? false : (row.needsReview ?? true),
    };
  });
}
