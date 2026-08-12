import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type TransactionsService = typeof import("./transactions");
type ImportInput = import("./transactions").ImportInput;

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let transactionsService: TransactionsService;

before(async () => {
  const [client, schema, service] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./transactions"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  transactionsService = service;
});

describe(
  "transaction import regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("reviews and skips persisted and in-file duplicates", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
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

      const rows: ImportInput[] = [
        {
          lineNumber: 2,
          amount: 12.5,
          date: "2026-03-01",
          type: "expense",
          category: "Uncategorized",
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
          notes: "Pay",
          tags: [],
          externalId: null,
        },
      ];

      try {
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

        const repeatReview = await transactionsService.reviewImport(
          userId,
          workspaceId,
          null,
          rows,
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
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
