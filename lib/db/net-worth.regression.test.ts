import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as debtsService from "./debts-credits";
import * as accountsService from "./financial-accounts";
import { getNetWorthSummary } from "./net-worth";

describe(
  "net worth debt-account links",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("counts a linked liability once and preserves unlinked and archived debt balances", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Net worth test user",
        email: `net-worth-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Net worth workspace",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Other net worth workspace",
          type: "business",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const cardAccount = await accountsService.create(userId, workspaceId, {
          name: "Card liability",
          accountClass: "liability",
          accountType: "credit_card",
          currency: "GBP",
          openingBalance: 500,
          openingDate: "2026-01-01",
        });
        const bankAccount = await accountsService.create(userId, workspaceId, {
          name: "Current account",
          accountClass: "asset",
          accountType: "checking",
          currency: "GBP",
          openingBalance: 0,
          openingDate: "2026-01-01",
        });
        const otherWorkspaceAccount = await accountsService.create(userId, otherWorkspaceId, {
          name: "Other workspace card",
          accountClass: "liability",
          accountType: "credit_card",
          currency: "GBP",
          openingBalance: 100,
          openingDate: "2026-01-01",
        });

        await assert.rejects(
          debtsService.create(userId, workspaceId, {
            name: "Invalid asset link",
            debtType: "overdraft",
            financialAccountId: bankAccount.id,
            currentBalance: 50,
          }),
          /Only liability accounts can be linked/,
        );
        await assert.rejects(
          debtsService.create(userId, workspaceId, {
            name: "Invalid workspace link",
            debtType: "credit_card",
            financialAccountId: otherWorkspaceAccount.id,
            currentBalance: 100,
          }),
          /Financial account not found in this workspace/,
        );

        await debtsService.create(userId, workspaceId, {
          name: "Linked card",
          debtType: "credit_card",
          financialAccountId: cardAccount.id,
          currentBalance: 500,
        });
        await assert.rejects(
          debtsService.create(userId, workspaceId, {
            name: "Duplicate card link",
            debtType: "credit_card",
            financialAccountId: cardAccount.id,
            currentBalance: 500,
          }),
          /already linked to another debt/,
        );
        await debtsService.create(userId, workspaceId, {
          name: "Unlinked loan",
          debtType: "loan",
          currentBalance: 200,
        });

        const linked = await getNetWorthSummary(userId, workspaceId);
        assert.equal(linked.accountLiabilities, 500);
        assert.equal(linked.debtsOwed, 200);
        assert.equal(linked.liabilities, 700, "the linked £500 balance must be counted once");

        await accountsService.update(userId, workspaceId, cardAccount.id, { isActive: false });
        const archived = await getNetWorthSummary(userId, workspaceId);
        assert.equal(archived.accountLiabilities, 0);
        assert.equal(archived.debtsOwed, 700);
        assert.equal(
          archived.liabilities,
          700,
          "archiving the account must fall back to the linked debt balance",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
