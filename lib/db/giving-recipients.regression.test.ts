import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as clientsService from "./clients";
import * as givingService from "./giving-recipients";
import * as transactionRulesService from "./transaction-rules";
import * as transactionsService from "./transactions";

describe(
  "giving recipients regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("scopes recipients and designations and only assigns them to giving", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Giving test user",
        email: `giving-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Personal",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Business",
          type: "business",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const recipient = await givingService.createRecipient(workspaceId, {
          name: "Community Church",
          notes: "Local recipient",
        });
        const designation = await givingService.createDesignation(workspaceId, {
          recipientId: recipient.id,
          name: "Building fund",
        });
        const otherRecipient = await givingService.createRecipient(otherWorkspaceId, {
          name: "Other recipient",
        });
        const otherDesignation = await givingService.createDesignation(otherWorkspaceId,
          { recipientId: otherRecipient.id, name: "Other fund" },
        );
        const client = await clientsService.create(workspaceId, { name: "Not a recipient" });
        await transactionRulesService.create(workspaceId, {
          name: "Client-only rule",
          matchField: "payee",
          matchValue: "community",
          clientId: client.id,
          priority: 10,
        });
        await transactionRulesService.create(workspaceId, {
          name: "Giving category rule",
          matchField: "payee",
          matchValue: "community",
          category: "Offering",
          transactionType: "giving",
          priority: 20,
        });
        const [classifiedGift] = await transactionRulesService.applyToImportRows(
          workspaceId,
          [{
            type: "giving" as const,
            payee: "Community Church",
            notes: null,
            category: "Uncategorized",
            tags: [],
          }],
        );
        assert.equal(classifiedGift.category, "Offering");
        assert.equal("clientId" in classifiedGift, false);

        assert.deepEqual(
          (await givingService.list(workspaceId)).map((row) => row.id),
          [recipient.id],
        );
        await assert.rejects(
          () =>
            givingService.createDesignation(workspaceId, {
              recipientId: otherRecipient.id,
              name: "Cross-workspace fund",
            }),
          /not found or unauthorized/,
        );

        const gift = await transactionsService.create(workspaceId, {
          amount: 100,
          date: "2026-08-12",
          type: "giving",
          category: "Offering",
          givingRecipientId: recipient.id,
          givingDesignationId: designation.id,
        });
        assert.equal(gift.givingRecipientId, recipient.id);
        assert.equal(gift.givingDesignationId, designation.id);

        await assert.rejects(
          () =>
            transactionsService.create(workspaceId, {
              amount: 10,
              date: "2026-08-12",
              type: "expense",
              category: "Food",
              givingRecipientId: recipient.id,
            }),
          /only be assigned to giving/,
        );
        await assert.rejects(
          () =>
            transactionsService.create(workspaceId, {
              amount: 10,
              date: "2026-08-12",
              type: "giving",
              category: "Offering",
              clientId: client.id,
            }),
          /Clients cannot be assigned to giving/,
        );
        await assert.rejects(
          () =>
            transactionsService.create(workspaceId, {
              amount: 10,
              date: "2026-08-12",
              type: "giving",
              category: "Offering",
              givingRecipientId: recipient.id,
              givingDesignationId: otherDesignation.id,
            }),
          /not found for this recipient/,
        );
        await assert.rejects(
          () => transactionsService.update(workspaceId, gift.id, { type: "expense" }),
          /only be assigned to giving/,
        );

        await assert.rejects(
          () => givingService.updateRecipient(otherWorkspaceId, recipient.id, { isActive: false }),
          /not found or unauthorized/,
        );
        await givingService.updateRecipient(workspaceId, recipient.id, { isActive: false });
        await givingService.updateDesignation(workspaceId, designation.id, { isActive: false });
        assert.deepEqual(await givingService.list(workspaceId, true), []);
        const preserved = await transactionsService.getById(workspaceId, gift.id);
        assert.equal(preserved?.givingRecipientId, recipient.id);
        assert.equal(preserved?.givingDesignationId, designation.id);

        const cleared = await transactionsService.update(workspaceId, gift.id, {
          givingRecipientId: null,
          givingDesignationId: null,
          type: "expense",
        });
        assert.equal(cleared.givingRecipientId, null);
        assert.equal(cleared.givingDesignationId, null);
        assert.equal(cleared.type, "expense");
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
