import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { transactionImportProfiles } from "@/db/schema";
import type { TransactionImportMapping } from "@/lib/transaction-import";
import * as financialAccountsService from "./financial-accounts";
import { ownerUserId } from "./workspaces";
import {
  idSchema,
  transactionImportProfileCreateSchema,
  workspaceIdSchema,
} from "./validation";

export interface SaveInput {
  name: string;
  accountId: string;
  mapping: TransactionImportMapping;
}

export async function list(workspaceId: string, accountId?: string) {
  workspaceIdSchema.parse(workspaceId);
  if (accountId) {
    idSchema.parse(accountId);
    await financialAccountsService.assertInWorkspace(workspaceId, accountId);
  }

  const conditions = [
    eq(transactionImportProfiles.workspaceId, workspaceId),
  ];
  if (accountId) {
    conditions.push(eq(transactionImportProfiles.financialAccountId, accountId));
  }

  return db
    .select()
    .from(transactionImportProfiles)
    .where(and(...conditions))
    .orderBy(asc(transactionImportProfiles.name));
}

export async function save(workspaceId: string, input: SaveInput) {
  workspaceIdSchema.parse(workspaceId);
  const validInput = transactionImportProfileCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  await financialAccountsService.assertInWorkspace(
    workspaceId,
    validInput.accountId,
  );

  const now = new Date();
  const [row] = await db
    .insert(transactionImportProfiles)
    .values({
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      financialAccountId: validInput.accountId,
      name: validInput.name,
      mapping: validInput.mapping,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        transactionImportProfiles.workspaceId,
        transactionImportProfiles.financialAccountId,
        transactionImportProfiles.name,
      ],
      set: { mapping: validInput.mapping, updatedAt: now },
    })
    .returning();
  return row;
}

export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const [removed] = await db
    .delete(transactionImportProfiles)
    .where(
      and(
        eq(transactionImportProfiles.id, id),
        eq(transactionImportProfiles.workspaceId, workspaceId),
      ),
    )
    .returning({ id: transactionImportProfiles.id });
  if (!removed) throw new Error("Import profile not found or unauthorized");
}
