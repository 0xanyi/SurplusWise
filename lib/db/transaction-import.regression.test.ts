import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type TransactionsService = typeof import("./transactions");
type TransactionRulesService = typeof import("./transaction-rules");
type ClientsService = typeof import("./clients");
type ImportInput = import("./transactions").ImportInput;

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let transactions: Schema["transactions"];
let transactionsService: TransactionsService;
let transactionRulesService: TransactionRulesService;
let clientsService: ClientsService;

before(async () => {
  const [client, schema, service, rulesService, clientService] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./transactions"),
    import("./transaction-rules"),
    import("./clients"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  transactions = schema.transactions;
  transactionsService = service;
  transactionRulesService = rulesService;
  clientsService = clientService;
});

describe(
  "transaction import regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("reviews and skips persisted and in-file duplicates", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Import test user",
        email: `import-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values({
        id: workspaceId,
        userId,
        name: "Personal",
        type: "personal",
        currency: "GBP",
        isDefault: true,
      });
      await db.insert(workspaces).values({
        id: otherWorkspaceId,
        userId,
        name: "Business",
        type: "business",
        currency: "GBP",
        isDefault: false,
      });

      const rows: ImportInput[] = [
        {
          lineNumber: 2,
          amount: 12.5,
          date: "2026-03-01",
          type: "expense",
          category: "Uncategorized",
          payee: "Cafe",
          notes: "Lunch",
          tags: [],
          externalId: "bank-row-1",
        },
        {
          lineNumber: 3,
          amount: 12.5,
          date: "2026-03-01",
          type: "expense",
          category: "Food",
          payee: "Cafe",
          notes: "Lunch",
          tags: [],
          externalId: "bank-row-1",
        },
        {
          lineNumber: 4,
          amount: 500,
          date: "2026-03-02",
          type: "income",
          category: "Uncategorized",
          payee: "Employer",
          notes: "Pay",
          tags: [],
          externalId: null,
        },
      ];

      try {
        const manual = await transactionsService.create(userId, workspaceId, {
          amount: 8.75,
          date: "2026-02-28",
          type: "expense",
          category: "Food",
          payee: "Corner Shop",
        });
        assert.equal(manual.payee, "Corner Shop");
        const searchResult = await transactionsService.list(userId, workspaceId, {
          search: "corner shop",
        });
        assert.deepEqual(searchResult.map((row) => row.id), [manual.id]);

        const broadRule = await transactionRulesService.create(userId, workspaceId, {
          name: "Broad cafe rule",
          matchField: "payee",
          matchValue: "cafe",
          category: "Broad match",
          priority: 20,
        });
        const preferredRule = await transactionRulesService.create(userId, workspaceId, {
          name: "Preferred cafe rule",
          matchField: "payee",
          matchValue: "CAFE",
          transactionType: "expense",
          category: "Food & Dining",
          tags: ["coffee"],
          markReviewed: true,
          priority: 10,
        });
        await transactionRulesService.create(userId, workspaceId, {
          name: "Disabled employer rule",
          matchField: "payee",
          matchValue: "Employer",
          category: "Salary",
          isActive: false,
        });
        await transactionRulesService.create(userId, workspaceId, {
          name: "Expense-only pay-note rule",
          matchField: "notes",
          matchValue: "pay",
          transactionType: "expense",
          category: "Salary",
        });
        assert.equal(
          (await transactionRulesService.list(userId, workspaceId))[0]?.id,
          preferredRule.id,
        );
        await assert.rejects(
          () => transactionRulesService.update(userId, otherWorkspaceId, broadRule.id, {
            name: "Cross-workspace update",
          }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => transactionRulesService.remove(userId, otherWorkspaceId, broadRule.id),
          /not found or unauthorized/,
        );
        const updatedBroadRule = await transactionRulesService.update(
          userId,
          workspaceId,
          broadRule.id,
          { name: "Updated broad cafe rule" },
        );
        assert.equal(updatedBroadRule?.name, "Updated broad cafe rule");
        await assert.rejects(
          () =>
            transactionRulesService.create(userId, workspaceId, {
              name: "Updated broad cafe rule",
              matchField: "payee",
              matchValue: "Duplicate",
              category: "Duplicate",
            }),
          /already exists/,
        );

        const otherClient = await clientsService.create(userId, otherWorkspaceId, {
          name: "Other workspace client",
        });
        await assert.rejects(
          () =>
            transactionRulesService.create(userId, workspaceId, {
              name: "Invalid client rule",
              matchField: "payee",
              matchValue: "Client",
              clientId: otherClient.id,
            }),
          /not found or unauthorized/,
        );
        const localClient = await clientsService.create(userId, workspaceId, {
          name: "Local client",
        });
        const clientRule = await transactionRulesService.create(userId, workspaceId, {
          name: "Local client rule",
          matchField: "payee",
          matchValue: "Local",
          clientId: localClient.id,
        });
        await clientsService.remove(userId, localClient.id);
        const disabledClientRule = (await transactionRulesService.list(userId, workspaceId)).find(
          (rule) => rule.id === clientRule.id,
        );
        assert.equal(disabledClientRule?.clientId, null);
        assert.equal(disabledClientRule?.isActive, false);
        const importClient = await clientsService.create(userId, workspaceId, {
          name: "Import client",
        });
        await transactionRulesService.create(userId, workspaceId, {
          name: "Employer client rule",
          matchField: "payee",
          matchValue: "employer",
          clientId: importClient.id,
          priority: 50,
        });

        const initialReview = await transactionsService.reviewImport(
          userId,
          workspaceId,
          null,
          rows,
        );
        assert.deepEqual(initialReview, {
          ready: 2,
          duplicateLineNumbers: [3],
        });

        const firstImport = await transactionsService.importRows(
          userId,
          workspaceId,
          null,
          rows,
        );
        assert.equal(firstImport.importedIds.length, 2);
        assert.deepEqual(firstImport.duplicateLineNumbers, [3]);
        const importedRows = await db
          .select({
            id: transactions.id,
            payee: transactions.payee,
            category: transactions.category,
            tags: transactions.tags,
            clientId: transactions.clientId,
            needsReview: transactions.needsReview,
          })
          .from(transactions)
          .where(eq(transactions.workspaceId, workspaceId));
        assert.deepEqual(
          new Set(importedRows.flatMap((row) => (row.payee ? [row.payee] : []))),
          new Set(["Corner Shop", "Cafe", "Employer"]),
        );
        assert.equal(importedRows.find((row) => row.id === manual.id)?.needsReview, false);
        const cafe = importedRows.find((row) => row.payee === "Cafe");
        const employer = importedRows.find((row) => row.payee === "Employer");
        assert.deepEqual(
          cafe && { category: cafe.category, tags: cafe.tags, needsReview: cafe.needsReview },
          { category: "Food & Dining", tags: ["coffee"], needsReview: false },
        );
        assert.deepEqual(
          employer && {
            category: employer.category,
            clientId: employer.clientId,
            needsReview: employer.needsReview,
          },
          { category: "Uncategorized", clientId: importClient.id, needsReview: true },
        );
        assert.deepEqual(
          (await transactionsService.list(userId, workspaceId, { needsReview: true }))
            .map((row) => row.id)
            .sort(),
          [employer?.id],
        );

        await assert.rejects(
          () =>
            transactionsService.bulkUpdateMetadata(userId, workspaceId, {
              ids: [manual.id, crypto.randomUUID()],
              category: "Changed",
            }),
          /not found in this workspace/,
        );
        assert.equal((await transactionsService.getById(userId, manual.id))?.category, "Food");

        await transactionsService.bulkUpdateMetadata(userId, workspaceId, {
          ids: employer ? [employer.id] : [],
          category: "Reviewed import",
          needsReview: false,
        });
        assert.deepEqual(
          await transactionsService.list(userId, workspaceId, { needsReview: true }),
          [],
        );
        const reviewedRows = await transactionsService.list(userId, workspaceId, {
          needsReview: false,
          category: "Reviewed import",
        });
        assert.deepEqual(
          reviewedRows.map((row) => row.id).sort(),
          [employer?.id],
        );

        const repeatReview = await transactionsService.reviewImport(
          userId,
          workspaceId,
          null,
          rows.map((row) =>
            row.lineNumber === 4 ? { ...row, payee: "Employer Limited" } : row,
          ),
        );
        assert.equal(repeatReview.ready, 0);
        assert.deepEqual(repeatReview.duplicateLineNumbers, [2, 3, 4]);

        const repeatedImport = await transactionsService.importRows(
          userId,
          workspaceId,
          null,
          rows,
        );
        assert.equal(repeatedImport.importedIds.length, 0);
        assert.deepEqual(repeatedImport.duplicateLineNumbers, [2, 3, 4]);

        await transactionRulesService.remove(userId, workspaceId, broadRule.id);
        assert.equal(
          (await transactionRulesService.list(userId, workspaceId)).some(
            (rule) => rule.id === broadRule.id,
          ),
          false,
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
