import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type AccountsService = typeof import("./financial-accounts");
type TransactionsService = typeof import("./transactions");

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let transactions: Schema["transactions"];
let accountsService: AccountsService;
let transactionsService: TransactionsService;

async function loadDeps() {
  const [client, schema, accounts, transactionRows] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./financial-accounts"),
    import("./transactions"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  transactions = schema.transactions;
  accountsService = accounts;
  transactionsService = transactionRows;
}

async function createTempWorkspace() {
  const userId = crypto.randomUUID();
  const suffix = userId.slice(0, 8);
  await db.insert(users).values({
    id: userId,
    name: `test-user-${suffix}`,
    email: `test-${suffix}@example.com`,
  });
  const workspaceId = crypto.randomUUID();
  await db.insert(workspaces).values({
    id: workspaceId,
    userId,
    name: "Personal",
    type: "personal",
    currency: "GBP",
    isDefault: true,
  });
  return { userId, workspaceId };
}

async function cleanupUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

describe(
  "financial accounts regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    before(loadDeps);

    it("balances assets, liabilities, pending money, transfers, and reconciliation", async () => {
      const { userId, workspaceId } = await createTempWorkspace();
      try {
        const bank = await accountsService.create(userId, workspaceId, {
          name: "Main bank",
          accountClass: "asset",
          accountType: "checking",
          currency: "GBP",
          openingBalance: 1000,
          openingDate: "2026-01-01",
        });
        const card = await accountsService.create(userId, workspaceId, {
          name: "Card",
          accountClass: "liability",
          accountType: "credit_card",
          currency: "GBP",
          openingBalance: 500,
          openingDate: "2026-01-01",
        });

        const bankExpense = await transactionsService.create(userId, workspaceId, {
          accountId: bank.id,
          amount: 100,
          date: "2026-01-05",
          type: "expense",
          category: "Food",
        });
        await transactionsService.create(userId, workspaceId, {
          accountId: bank.id,
          amount: 200,
          date: "2026-01-06",
          type: "income",
          category: "Salary",
        });
        const pending = await transactionsService.create(userId, workspaceId, {
          accountId: bank.id,
          status: "pending",
          amount: 50,
          date: "2026-01-07",
          type: "giving",
          category: "Tithe",
        });
        await transactionsService.create(userId, workspaceId, {
          accountId: card.id,
          amount: 100,
          date: "2026-01-08",
          type: "expense",
          category: "Travel",
        });
        const transfer = await accountsService.createTransfer(userId, workspaceId, {
          fromAccountId: bank.id,
          toAccountId: card.id,
          amount: 200,
          date: "2026-01-09",
        });

        const rows = await accountsService.list(userId, workspaceId);
        const bankBalance = rows.find((row) => row.id === bank.id);
        const cardBalance = rows.find((row) => row.id === card.id);
        assert.equal(bankBalance?.currentBalance, 900);
        assert.equal(bankBalance?.projectedBalance, 850);
        assert.equal(cardBalance?.currentBalance, 400);

        const mismatch = await accountsService.reconcile(userId, workspaceId, bank.id, {
          statementDate: "2026-01-31",
          statementBalance: 899,
        });
        assert.deepEqual(mismatch, {
          reconciled: false,
          calculatedBalance: 900,
          difference: -1,
        });

        const matched = await accountsService.reconcile(userId, workspaceId, bank.id, {
          statementDate: "2026-01-31",
          statementBalance: 900,
        });
        assert.equal(matched.reconciled, true);

        const [lockedRow] = await db
          .select({ status: transactions.status })
          .from(transactions)
          .where(eq(transactions.id, bankExpense.id));
        const [pendingRow] = await db
          .select({ status: transactions.status })
          .from(transactions)
          .where(eq(transactions.id, pending.id));
        assert.equal(lockedRow.status, "reconciled");
        assert.equal(pendingRow.status, "pending");
        await assert.rejects(
          () => transactionsService.update(userId, bankExpense.id, { status: "cleared" }),
          /Reconciled transaction ledger fields cannot be changed/,
        );
        await assert.rejects(
          () => transactionsService.update(userId, pending.id, { status: "cleared" }),
          /locked by reconciliation/,
        );
        await assert.rejects(
          () => transactionsService.remove(userId, bankExpense.id),
          /Reconciled transactions cannot be deleted/,
        );
        await assert.rejects(
          () =>
            transactionsService.create(userId, workspaceId, {
              accountId: bank.id,
              status: "reconciled",
              amount: 10,
              date: "2026-02-01",
              type: "income",
              category: "Adjustment",
            }),
          /only be reconciled through account reconciliation/,
        );
        await assert.rejects(
          () =>
            transactionsService.create(userId, workspaceId, {
              accountId: bank.id,
              amount: 10,
              date: "2026-01-15",
              type: "expense",
              category: "Adjustment",
            }),
          /locked by reconciliation/,
        );
        await assert.rejects(
          () => accountsService.removeTransfer(userId, workspaceId, transfer.id),
          /locked by reconciliation/,
        );
        await assert.rejects(
          () =>
            accountsService.createTransfer(userId, workspaceId, {
              fromAccountId: bank.id,
              toAccountId: card.id,
              amount: 10,
              date: "2026-01-15",
            }),
          /locked by reconciliation/,
        );
        await assert.rejects(
          () =>
            accountsService.reconcile(userId, workspaceId, bank.id, {
              statementDate: "2026-01-15",
              statementBalance: 900,
            }),
          /Statement date must be after 2026-01-31/,
        );
      } finally {
        await cleanupUser(userId);
      }
    });
  },
);
