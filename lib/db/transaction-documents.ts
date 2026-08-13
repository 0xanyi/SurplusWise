import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { transactionDocuments, transactions } from "@/db/schema";
import { MAX_SUPPORTING_DOCUMENTS, safeDocumentFileName } from "@/lib/supporting-documents";
import { idSchema, userIdSchema, workspaceIdSchema } from "./validation";

async function getOwnedTransaction(
  userId: string,
  workspaceId: string,
  transactionId: string,
  requireGiving = true,
) {
  const [row] = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Transaction not found or unauthorized");
  if (requireGiving && row.type !== "giving") {
    throw new Error("Supporting documents are only available for giving transactions");
  }
  return row;
}

export async function list(userId: string, workspaceId: string, transactionId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  await getOwnedTransaction(userId, workspaceId, transactionId);
  return db
    .select()
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.userId, userId),
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    )
    .orderBy(asc(transactionDocuments.createdAt));
}

export async function assertCanUpload(
  userId: string,
  workspaceId: string,
  transactionId: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  const transaction = await getOwnedTransaction(userId, workspaceId, transactionId);
  if (transaction.type !== "giving") {
    throw new Error("Supporting documents can only be added to giving transactions");
  }
  const [result] = await db
    .select({ value: count() })
    .from(transactionDocuments)
    .where(eq(transactionDocuments.transactionId, transactionId));
  if ((result?.value ?? 0) >= MAX_SUPPORTING_DOCUMENTS) {
    throw new Error(`A gift can have at most ${MAX_SUPPORTING_DOCUMENTS} supporting documents`);
  }
}

export async function create(
  userId: string,
  workspaceId: string,
  transactionId: string,
  input: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .select({ id: transactions.id, type: transactions.type })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.workspaceId, workspaceId),
        ),
      )
      .limit(1)
      .for("update");
    if (!transaction) throw new Error("Transaction not found or unauthorized");
    if (transaction.type !== "giving") {
      throw new Error("Supporting documents can only be added to giving transactions");
    }

    const [result] = await tx
      .select({ value: count() })
      .from(transactionDocuments)
      .where(eq(transactionDocuments.transactionId, transactionId));
    if ((result?.value ?? 0) >= MAX_SUPPORTING_DOCUMENTS) {
      throw new Error(`A gift can have at most ${MAX_SUPPORTING_DOCUMENTS} supporting documents`);
    }

    const [row] = await tx
      .insert(transactionDocuments)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        transactionId,
        storageKey: input.storageKey,
        fileName: safeDocumentFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    return row;
  });
}

export async function listForTransactionDeletion(
  userId: string,
  workspaceId: string,
  transactionId: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  await getOwnedTransaction(userId, workspaceId, transactionId, false);
  return db
    .select({ storageKey: transactionDocuments.storageKey })
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.userId, userId),
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    );
}

export async function get(
  userId: string,
  workspaceId: string,
  transactionId: string,
  documentId: string,
) {
  idSchema.parse(documentId);
  await getOwnedTransaction(userId, workspaceId, transactionId);
  const [row] = await db
    .select()
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.id, documentId),
        eq(transactionDocuments.userId, userId),
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Supporting document not found or unauthorized");
  return row;
}

export async function remove(
  userId: string,
  workspaceId: string,
  transactionId: string,
  documentId: string,
) {
  const existing = await get(userId, workspaceId, transactionId, documentId);
  await db.transaction(async (tx) => {
    await tx
      .delete(transactionDocuments)
      .where(
        and(
          eq(transactionDocuments.id, documentId),
          eq(transactionDocuments.userId, userId),
          eq(transactionDocuments.workspaceId, workspaceId),
          eq(transactionDocuments.transactionId, transactionId),
        ),
      );
    await tx
      .update(transactions)
      .set({ receiptStorageId: null, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.workspaceId, workspaceId),
          eq(transactions.receiptStorageId, existing.storageKey),
        ),
      );
  });
  return existing;
}
