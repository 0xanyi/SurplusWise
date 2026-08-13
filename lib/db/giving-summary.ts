import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { givingDesignations, givingRecipients, transactions } from "@/db/schema";
import { userIdSchema, workspaceIdSchema } from "./validation";

export async function getAnnualSummary(userId: string, workspaceId: string, year: number) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error("Year must be a whole number between 1900 and 9999");
  }

  const rows = await db
    .select({
      recipientId: transactions.givingRecipientId,
      recipientName: givingRecipients.name,
      designationId: transactions.givingDesignationId,
      designationName: givingDesignations.name,
      giftCount: count(),
      amount: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(givingRecipients, eq(transactions.givingRecipientId, givingRecipients.id))
    .leftJoin(givingDesignations, eq(transactions.givingDesignationId, givingDesignations.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.workspaceId, workspaceId),
        eq(transactions.type, "giving"),
        gte(transactions.date, `${year}-01-01`),
        lte(transactions.date, `${year}-12-31`),
      ),
    )
    .groupBy(
      transactions.givingRecipientId,
      givingRecipients.name,
      transactions.givingDesignationId,
      givingDesignations.name,
    )
    .orderBy(asc(givingRecipients.name), asc(givingDesignations.name));

  const recipients = new Map<
    string,
    {
      recipientId: string | null;
      recipientName: string;
      giftCount: number;
      amount: number;
      designations: Array<{
        designationId: string | null;
        designationName: string;
        giftCount: number;
        amount: number;
      }>;
    }
  >();

  for (const row of rows) {
    const recipientKey = row.recipientId ?? "unassigned";
    const recipient = recipients.get(recipientKey) ?? {
      recipientId: row.recipientId,
      recipientName: row.recipientName ?? "Unassigned recipient",
      giftCount: 0,
      amount: 0,
      designations: [],
    };
    const amount = Number(row.amount);
    recipient.giftCount += row.giftCount;
    recipient.amount += amount;
    recipient.designations.push({
      designationId: row.designationId,
      designationName: row.designationName ?? (row.recipientId ? "General / undesignated" : "Unassigned"),
      giftCount: row.giftCount,
      amount,
    });
    recipients.set(recipientKey, recipient);
  }

  const recipientRows = [...recipients.values()].map((recipient) => ({
    ...recipient,
    amount: Math.round((recipient.amount + Number.EPSILON) * 100) / 100,
  }));
  return {
    year,
    giftCount: recipientRows.reduce((sum, row) => sum + row.giftCount, 0),
    amount:
      Math.round(
        (recipientRows.reduce((sum, row) => sum + row.amount, 0) + Number.EPSILON) * 100,
      ) / 100,
    recipients: recipientRows,
  };
}
