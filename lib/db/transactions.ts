import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import * as clientsService from "./clients";
import {
  userIdSchema,
  idSchema,
  limitSchema,
  pageSchema,
  pageSizeSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionListFiltersSchema,
  workspaceIdSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type TransactionType = "expense" | "giving" | "income";

export interface ListFilters {
  type?: TransactionType;
  category?: string;
  clientId?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedFilters extends ListFilters {
  limit: number;
  cursor?: string; // createdAt ISO cursor for keyset pagination
}

export interface CreateInput {
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  clientId?: string | null;
  notes?: string | null;
  tags?: string[];
  receiptStorageId?: string | null;
}

export interface UpdateInput {
  amount?: number;
  date?: string;
  type?: TransactionType;
  category?: string;
  clientId?: string | null;
  notes?: string | null;
  tags?: string[];
  receiptStorageId?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

function buildWhere(userId: string, workspaceId: string, filters: ListFilters) {
  const conditions = [
    eq(transactions.userId, userId),
    eq(transactions.workspaceId, workspaceId),
  ];

  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.category) conditions.push(eq(transactions.category, filters.category));
  if (filters.clientId) conditions.push(eq(transactions.clientId, filters.clientId));
  if (filters.tag) conditions.push(sql`${transactions.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
  if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(transactions.category, pattern),
        ilike(transactions.notes, pattern),
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${transactions.tags}) AS tag
          WHERE tag ILIKE ${pattern}
        )`,
      )!,
    );
  }

  return and(...conditions);
}

// ─── Service functions ───────────────────────────────────────────────────────

/** Full list with optional filters, ordered newest-first. */
export async function list(userId: string, workspaceId: string, filters: ListFilters = {}) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const validFilters = transactionListFiltersSchema.parse(filters);
  return db
    .select()
    .from(transactions)
    .where(buildWhere(userId, workspaceId, validFilters))
    .orderBy(desc(transactions.date));
}

/** Newest N transactions for the dashboard widget. */
export async function listRecent(userId: string, workspaceId: string, limit = 5) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  limitSchema.parse(limit);
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.workspaceId, workspaceId)))
    .orderBy(desc(transactions.date))
    .limit(limit);
}

/**
 * Offset-based pagination (simpler than keyset for the current UI).
 * Returns rows + whether there are more.
 */
export async function listPaginated(
  userId: string,
  workspaceId: string,
  filters: ListFilters = {},
  page = 0,
  pageSize = 25,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const validFilters = transactionListFiltersSchema.parse(filters);
  pageSchema.parse(page);
  pageSizeSchema.parse(pageSize);
  const rows = await db
    .select()
    .from(transactions)
    .where(buildWhere(userId, workspaceId, validFilters))
    .orderBy(desc(transactions.date))
    .limit(pageSize + 1) // fetch one extra to check hasMore
    .offset(page * pageSize);

  const hasMore = rows.length > pageSize;
  if (hasMore) rows.pop();

  return { rows, hasMore, page, pageSize };
}

/** Fetch a single transaction (null if not found or wrong user). */
export async function getById(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Create and return the new row. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  transactionCreateSchema.parse(input);
  if (input.clientId) {
    await clientsService.assertInWorkspace(userId, workspaceId, input.clientId);
  }
  const id = genId();
  const now = new Date();
  const [row] = await db
    .insert(transactions)
    .values({
      id,
      userId,
      workspaceId,
      amount: String(input.amount),
      date: input.date,
      type: input.type,
      category: input.category,
      clientId: input.clientId ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      receiptStorageId: input.receiptStorageId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  transactionUpdateSchema.parse(input);
  const existing = await getById(userId, id);
  if (!existing) throw new Error("Transaction not found or unauthorized");

  if (input.clientId && input.clientId !== existing.clientId) {
    // Checked against the row's own workspace, so a client from another
    // workspace cannot be attached to this money.
    if (!existing.workspaceId) {
      throw new Error("This transaction has no workspace, so it cannot be attributed");
    }
    await clientsService.assertInWorkspace(userId, existing.workspaceId, input.clientId);
  }

  const [row] = await db
    .update(transactions)
    .set({
      ...(input.amount !== undefined && { amount: String(input.amount) }),
      ...(input.date !== undefined && { date: input.date }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.clientId !== undefined && { clientId: input.clientId ?? null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.receiptStorageId !== undefined && { receiptStorageId: input.receiptStorageId }),
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return row;
}

/** Delete a transaction. Throws if not found / unauthorized. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const existing = await getById(userId, id);
  if (!existing) throw new Error("Transaction not found or unauthorized");

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

/**
 * Sum of `amount` grouped by type for a date range.
 * Used internally by analytics and budget-spending.
 */
export async function sumByTypeAndCategory(
  userId: string,
  workspaceId: string,
  startDate: string,
  endDate: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  return db
    .select({
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.workspaceId, workspaceId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )
    .groupBy(transactions.type, transactions.category);
}
