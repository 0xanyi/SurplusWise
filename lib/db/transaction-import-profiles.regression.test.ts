import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type AccountsService = typeof import("./financial-accounts");
type ProfilesService = typeof import("./transaction-import-profiles");

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let financialAccounts: Schema["financialAccounts"];
let profilesTable: Schema["transactionImportProfiles"];
let accountsService: AccountsService;
let profilesService: ProfilesService;

before(async () => {
  const [client, schema, accounts, profiles] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./financial-accounts"),
    import("./transaction-import-profiles"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  financialAccounts = schema.financialAccounts;
  profilesTable = schema.transactionImportProfiles;
  accountsService = accounts;
  profilesService = profiles;
});

async function createWorkspace(userId = crypto.randomUUID()) {
  const workspaceId = crypto.randomUUID();
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: userId,
      name: "Import profile test user",
      email: `profiles-${userId.slice(0, 8)}@example.com`,
    });
  }
  await db.insert(workspaces).values({
    id: workspaceId,
    userId,
    name: `Workspace ${workspaceId.slice(0, 8)}`,
    type: "personal",
    currency: "GBP",
    isDefault: false,
  });
  const account = await accountsService.create(userId, workspaceId, {
    name: "Current account",
    accountClass: "asset",
    accountType: "checking",
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2026-01-01",
  });
  return { userId, workspaceId, account };
}

describe(
  "transaction import profiles regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("scopes reusable mappings to their owner, workspace, and account", async () => {
      const owner = await createWorkspace();
      const other = await createWorkspace(owner.userId);
      try {
        const saved = await profilesService.save(owner.userId, owner.workspaceId, {
          name: "Bank export",
          accountId: owner.account.id,
          mapping: { date: "Date", amount: "Amount", payee: "Merchant" },
        });

        assert.deepEqual(
          await profilesService.list(owner.userId, owner.workspaceId, owner.account.id),
          [saved],
        );
        assert.deepEqual(
          await profilesService.list(other.userId, other.workspaceId, other.account.id),
          [],
        );
        await assert.rejects(
          () =>
            profilesService.save(other.userId, other.workspaceId, {
              name: "Stolen mapping",
              accountId: owner.account.id,
              mapping: { date: "Date", amount: "Amount" },
            }),
          /Financial account not found in this workspace/,
        );
        await assert.rejects(
          () => profilesService.remove(other.userId, other.workspaceId, saved.id),
          /not found or unauthorized/,
        );

        const updated = await profilesService.save(owner.userId, owner.workspaceId, {
          name: "Bank export",
          accountId: owner.account.id,
          mapping: { date: "Posted", debit: "Out", credit: "In" },
        });
        assert.equal(updated.id, saved.id);
        assert.deepEqual(updated.mapping, { date: "Posted", debit: "Out", credit: "In" });

        await profilesService.remove(owner.userId, owner.workspaceId, saved.id);
        assert.deepEqual(
          await profilesService.list(owner.userId, owner.workspaceId, owner.account.id),
          [],
        );
        await profilesService.save(owner.userId, owner.workspaceId, {
          name: "Cascade mapping",
          accountId: owner.account.id,
          mapping: { date: "Date", amount: "Amount" },
        });
        await db.delete(financialAccounts).where(eq(financialAccounts.id, owner.account.id));
        const rows = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.financialAccountId, owner.account.id));
        assert.deepEqual(rows, []);
      } finally {
        await db.delete(users).where(eq(users.id, owner.userId));
      }
    });
  },
);
