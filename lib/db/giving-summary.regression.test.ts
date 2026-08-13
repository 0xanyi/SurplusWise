import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as givingRecipientsService from "./giving-recipients";
import { getAnnualSummary } from "./giving-summary";
import * as transactionsService from "./transactions";

describe(
  "annual giving summary regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("groups only the selected workspace and year by recipient and designation", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Giving summary test user",
        email: `giving-summary-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        { id: workspaceId, userId, name: "Personal", type: "personal", currency: "GBP", isDefault: true },
        { id: otherWorkspaceId, userId, name: "Other", type: "personal", currency: "GBP", isDefault: false },
      ]);

      try {
        const recipient = await givingRecipientsService.createRecipient(userId, workspaceId, {
          name: "Community Church",
        });
        const designation = await givingRecipientsService.createDesignation(
          userId,
          workspaceId,
          { recipientId: recipient.id, name: "Building fund" },
        );
        for (const input of [
          { amount: 100, date: "2026-01-15", givingRecipientId: recipient.id, givingDesignationId: designation.id },
          { amount: 50, date: "2026-02-15", givingRecipientId: recipient.id, givingDesignationId: designation.id },
          { amount: 25, date: "2026-03-15", givingRecipientId: recipient.id },
          { amount: 10, date: "2026-04-15" },
        ]) {
          await transactionsService.create(userId, workspaceId, {
            ...input,
            type: "giving",
            category: "Offering",
          });
        }
        await transactionsService.create(userId, workspaceId, {
          amount: 500,
          date: "2025-12-31",
          type: "giving",
          category: "Offering",
        });
        await transactionsService.create(userId, otherWorkspaceId, {
          amount: 600,
          date: "2026-06-01",
          type: "giving",
          category: "Offering",
        });
        await transactionsService.create(userId, workspaceId, {
          amount: 700,
          date: "2026-07-01",
          type: "expense",
          category: "Food",
        });

        const summary = await getAnnualSummary(userId, workspaceId, 2026);
        assert.equal(summary.giftCount, 4);
        assert.equal(summary.amount, 185);
        const attributed = summary.recipients.find((row) => row.recipientId === recipient.id);
        assert.equal(attributed?.giftCount, 3);
        assert.equal(attributed?.amount, 175);
        assert.deepEqual(
          attributed?.designations.map((row) => ({ name: row.designationName, count: row.giftCount, amount: row.amount })),
          [
            { name: "Building fund", count: 2, amount: 150 },
            { name: "General / undesignated", count: 1, amount: 25 },
          ],
        );
        const unassigned = summary.recipients.find((row) => row.recipientId === null);
        assert.equal(unassigned?.recipientName, "Unassigned recipient");
        assert.equal(unassigned?.amount, 10);
        assert.equal((await getAnnualSummary(userId, workspaceId, 2024)).giftCount, 0);
        await assert.rejects(() => getAnnualSummary(userId, workspaceId, 1899), /between 1900 and 9999/);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
