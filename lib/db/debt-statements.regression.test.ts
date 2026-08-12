import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

// Integration tests: they need a migrated Postgres. The modules below connect
// at import time, so they are loaded lazily and the suite skips itself when
// DATABASE_URL is absent (same pattern as categories.regression.test.ts).
type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type StatementsService = typeof import("./debt-statements");

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let debtsCredits: Schema["debtsCredits"];
let debtStatements: Schema["debtStatements"];
let statementsService: StatementsService;

async function loadDeps() {
  const [client, schema, service] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./debt-statements"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  debtsCredits = schema.debtsCredits;
  debtStatements = schema.debtStatements;
  statementsService = service;
}

async function createTempDebt() {
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
    isDefault: true,
  });
  const debtId = crypto.randomUUID();
  await db.insert(debtsCredits).values({
    id: debtId,
    userId,
    workspaceId,
    name: "Test card",
    debtType: "credit_card",
    currentBalance: "2500",
    interestRate: "24.90",
  });
  return { userId, debtId };
}

async function cleanupUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

const baseStatement = {
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  statementDate: "2026-05-31",
  openingBalance: 2500,
  closingBalance: 2400,
};

const splitBuckets = [
  {
    type: "balance_transfer" as const,
    label: "0% until March",
    balanceSubjectToInterest: 2000,
    interestCharged: 0,
    apr: 0,
  },
  {
    type: "purchases" as const,
    balanceSubjectToInterest: 500,
    interestCharged: 10,
    apr: 24.9,
  },
];

describe(
  "debt statements interest breakdown",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    before(loadDeps);

    it("create with a breakdown stores jsonb and sum-derived columns", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        const created = await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          // Client totals disagree with the sums; sums must win.
          interestCharged: 999,
          balanceSubjectToInterest: 1,
          interestBreakdown: splitBuckets,
        });

        assert.strictEqual(Number(created.interestCharged), 10);
        assert.strictEqual(Number(created.balanceSubjectToInterest), 2500);

        const [row] = await db
          .select()
          .from(debtStatements)
          .where(eq(debtStatements.id, created.id));
        assert.ok(Array.isArray(row.interestBreakdown));
        assert.strictEqual(row.interestBreakdown?.length, 2);
      } finally {
        await cleanupUser(userId);
      }
    });

    it("create without a breakdown stores null and keeps the sent totals", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        const created = await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          interestCharged: 12.5,
          balanceSubjectToInterest: 800,
        });

        assert.strictEqual(Number(created.interestCharged), 12.5);
        assert.strictEqual(Number(created.balanceSubjectToInterest), 800);
        assert.strictEqual(created.interestBreakdown, null);

        // An empty array also means "no split".
        const second = await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          statementDate: "2026-06-30",
          interestBreakdown: [],
        });
        assert.strictEqual(second.interestBreakdown, null);
      } finally {
        await cleanupUser(userId);
      }
    });

    it("update replaces a breakdown and re-derives the totals", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        const created = await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          interestBreakdown: splitBuckets,
        });

        const updated = await statementsService.updateStatement(
          userId,
          debtId,
          created.id,
          {
            interestBreakdown: [
              {
                type: "cash_advance",
                balanceSubjectToInterest: 300,
                interestCharged: 9,
                apr: 29.9,
              },
            ],
          },
        );

        assert.strictEqual(Number(updated.interestCharged), 9);
        assert.strictEqual(Number(updated.balanceSubjectToInterest), 300);
        const breakdown = updated.interestBreakdown as unknown[];
        assert.strictEqual(breakdown.length, 1);
      } finally {
        await cleanupUser(userId);
      }
    });

    it("update with null clears the split and keeps patched totals", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        const created = await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          interestBreakdown: splitBuckets,
        });

        const updated = await statementsService.updateStatement(
          userId,
          debtId,
          created.id,
          { interestBreakdown: null, interestCharged: 15 },
        );

        assert.strictEqual(updated.interestBreakdown, null);
        assert.strictEqual(Number(updated.interestCharged), 15);
      } finally {
        await cleanupUser(userId);
      }
    });

    it("rejects invalid breakdowns", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        await assert.rejects(() =>
          statementsService.createStatement(userId, debtId, {
            ...baseStatement,
            interestBreakdown: [
              // Deliberately invalid type to prove zod rejects it at runtime.
              { type: "mortgage", balanceSubjectToInterest: 1, interestCharged: 1 },
            ] as unknown as Parameters<typeof statementsService.createStatement>[2]["interestBreakdown"],
          }),
        );
        await assert.rejects(() =>
          statementsService.createStatement(userId, debtId, {
            ...baseStatement,
            interestBreakdown: Array.from({ length: 9 }, () => ({
              type: "other" as const,
              balanceSubjectToInterest: 1,
              interestCharged: 1,
            })),
          }),
        );
      } finally {
        await cleanupUser(userId);
      }
    });

    it("list enriches buckets with rates and keeps the blended statement rate", async () => {
      const { userId, debtId } = await createTempDebt();
      try {
        await statementsService.createStatement(userId, debtId, {
          ...baseStatement,
          interestBreakdown: splitBuckets,
        });

        const [statement] = await statementsService.listStatements(userId, debtId);
        assert.ok(statement);

        // Blended: exact, because the summed basis is printed, not estimated.
        assert.ok(statement.rate);
        assert.strictEqual(statement.rate.estimated, false);
        assert.strictEqual(statement.rate.basis, 2500);

        assert.ok(statement.interestBreakdown);
        const [bt, purchases] = statement.interestBreakdown;

        // 0% line: zero interest on a real basis.
        assert.ok(bt.rate);
        assert.strictEqual(bt.rate.annualisedPercent, 0);
        assert.strictEqual(bt.rateVariance, 0); // 0 - apr 0
        assert.strictEqual(bt.label, "0% until March");

        // 2% monthly on £500 compounds well above the 24.9% APR.
        assert.ok(purchases.rate);
        assert.strictEqual(purchases.rate.basis, 500);
        assert.ok(purchases.rateVariance !== null && purchases.rateVariance > 1);
        assert.strictEqual(purchases.label, null);
      } finally {
        await cleanupUser(userId);
      }
    });
  },
);
