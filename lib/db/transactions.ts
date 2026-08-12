import { createHash } from "node:crypto";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import * as clientsService from "./clients";
import * as financialAccountsService from "./financial-accounts";
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
type TransactionStatus = "pending" | "cleared" | "reconciled";

export interface ListFilters {
  type?: TransactionType;
  accountId?: string;
  status?: TransactionStatus;
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
  accountId?: string | null;
  status?: TransactionStatus;
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
  accountId?: string | null;
  status?: TransactionStatus;
  category?: string;
  clientId?: string | null;
  notes?: string | null;
  tags?: string[];
  receiptStorageId?: string | null;
}

export interface ImportInput {
  lineNumber: number;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  notes: string | null;
  tags: string[];
  externalId: string | null;
}

interface ImportCandidate extends ImportInput {
  fingerprint: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

function normalizedImportIdentity(row: ImportInput) {
  if (row.externalId) {
    return `external:${row.externalId.trim().toLowerCase()}`;
  }
  return [
    row.date,
    row.amount.toFixed(2),
    row.type,
    row.notes?.trim().toLowerCase().replace(/\s+/g, " ") ?? "",
  ].join("|");
}

function prepareImportCandidates(accountId: string | null, rows: ImportInput[]) {
  const occurrences = new Map<string, number>();
  return rows.map((row): ImportCandidate => {
    const identity = normalizedImportIdentity(row);
    const occurrence = row.externalId ? 0 : (occurrences.get(identity) ?? 0);
    occurrences.set(identity, occurrence + 1);
    const fingerprint = createHash("sha256")
      .update(`${accountId ?? "unassigned"}|${identity}|${occurrence}`)
      .digest("hex");
    return { ...row, fingerprint };
  });
}

async function validateImport(
  userId: string,
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (accountId) {
    const account = await financialAccountsService.assertInWorkspace(
      userId,
      workspaceId,
      accountId,
    );
    for (const row of rows) {
      financialAccountsService.assertDateIsOpen(account, row.date);
    }
  }
  for (const row of rows) {
    transactionCreateSchema.parse(row);
  }
  return prepareImportCandidates(accountId, rows);
}

async function existingImportFingerprints(workspaceId: string, fingerprints: string[]) {
  if (fingerprints.length === 0) return new Set<string>();
  const rows = await db
    .select({ fingerprint: transactions.importFingerprint })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        inArray(transactions.importFingerprint, fingerprints),
      ),
    );
  return new Set(rows.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])));
}

function buildWhere(userId: string, workspaceId: string, filters: ListFilters) {
  const conditions = [
    eq(transactions.userId, userId),
    eq(transactions.workspaceId, workspaceId),
  ];

  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
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
  if (input.status === "reconciled") {
    throw new Error("Transactions can only be reconciled through account reconciliation");
  }
  if (input.accountId) {
    const account = await financialAccountsService.assertInWorkspace(
      userId,
      workspaceId,
      input.accountId,
    );
    financialAccountsService.assertDateIsOpen(account, input.date);
  }
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
      accountId: input.accountId ?? null,
      status: input.status ?? "cleared",
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

export async function reviewImport(
  userId: string,
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  const candidates = await validateImport(userId, workspaceId, accountId, rows);
  const existing = await existingImportFingerprints(
    workspaceId,
    candidates.map((row) => row.fingerprint),
  );
  const seen = new Set<string>();
  const duplicateLineNumbers = candidates
    .filter((row) => {
      const duplicate = existing.has(row.fingerprint) || seen.has(row.fingerprint);
      seen.add(row.fingerprint);
      return duplicate;
    })
    .map((row) => row.lineNumber);
  return {
    ready: candidates.length - duplicateLineNumbers.length,
    duplicateLineNumbers,
  };
}

export async function importRows(
  userId: string,
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  const candidates = await validateImport(userId, workspaceId, accountId, rows);
  if (candidates.length === 0) {
    return { importedIds: [] as string[], duplicateLineNumbers: [] as number[] };
  }

  const seen = new Set<string>();
  const duplicateLineNumbers: number[] = [];
  const uniqueCandidates = candidates.filter((row) => {
    if (seen.has(row.fingerprint)) {
      duplicateLineNumbers.push(row.lineNumber);
      return false;
    }
    seen.add(row.fingerprint);
    return true;
  });
  const existing = await existingImportFingerprints(
    workspaceId,
    uniqueCandidates.map((row) => row.fingerprint),
  );
  const rowsToInsert = uniqueCandidates.filter((row) => {
    if (existing.has(row.fingerprint)) {
      duplicateLineNumbers.push(row.lineNumber);
      return false;
    }
    return true;
  });
  if (rowsToInsert.length === 0) {
    return {
      importedIds: [] as string[],
      duplicateLineNumbers: duplicateLineNumbers.sort((a, b) => a - b),
    };
  }

  const inserted = await db
    .insert(transactions)
    .values(
      rowsToInsert.map((row) => ({
        id: genId(),
        userId,
        workspaceId,
        accountId,
        amount: String(row.amount),
        date: row.date,
        type: row.type,
        status: "cleared" as const,
        category: row.category,
        notes: row.notes,
        tags: row.tags,
        receiptStorageId: null,
        importFingerprint: row.fingerprint,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    )
    .onConflictDoNothing({
      target: [transactions.workspaceId, transactions.importFingerprint],
    })
    .returning({ id: transactions.id, fingerprint: transactions.importFingerprint });

  const insertedFingerprints = new Set(
    inserted.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])),
  );
  duplicateLineNumbers.push(
    ...rowsToInsert
      .filter((row) => !insertedFingerprints.has(row.fingerprint))
      .map((row) => row.lineNumber),
  );
  return {
    importedIds: inserted.map((row) => row.id),
    duplicateLineNumbers: duplicateLineNumbers.sort((a, b) => a - b),
  };
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  transactionUpdateSchema.parse(input);
  const existing = await getById(userId, id);
  if (!existing) throw new Error("Transaction not found or unauthorized");

  if (
    existing.status === "reconciled" &&
    (input.amount !== undefined ||
      input.date !== undefined ||
      input.type !== undefined ||
      input.accountId !== undefined ||
      (input.status !== undefined && input.status !== "reconciled"))
  ) {
    throw new Error("Reconciled transaction ledger fields cannot be changed");
  }

  const changesLedger =
    input.amount !== undefined ||
    input.date !== undefined ||
    input.type !== undefined ||
    input.accountId !== undefined ||
    input.status !== undefined;
  if (changesLedger && existing.workspaceId) {
    const effectiveDate = input.date ?? existing.date;
    const affectedAccountIds = new Set(
      [existing.accountId, input.accountId === undefined ? existing.accountId : input.accountId].filter(
        (accountId): accountId is string => Boolean(accountId),
      ),
    );
    for (const accountId of affectedAccountIds) {
      const account = await financialAccountsService.assertInWorkspace(
        userId,
        existing.workspaceId,
        accountId,
      );
      financialAccountsService.assertDateIsOpen(
        account,
        accountId === existing.accountId ? existing.date : effectiveDate,
      );
      if (accountId === existing.accountId && effectiveDate !== existing.date) {
        financialAccountsService.assertDateIsOpen(account, effectiveDate);
      }
    }
  } else if (input.accountId && !existing.workspaceId) {
    throw new Error("This transaction has no workspace, so it cannot be assigned to an account");
  }

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
      ...(input.accountId !== undefined && { accountId: input.accountId ?? null }),
      ...(input.status !== undefined && { status: input.status }),
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
  if (existing.status === "reconciled") {
    throw new Error("Reconciled transactions cannot be deleted");
  }

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
