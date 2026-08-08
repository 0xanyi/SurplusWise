import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

// These are integration tests: they need a migrated Postgres. The modules below
// connect at import time, so they are loaded lazily and the suite skips itself
// when DATABASE_URL is absent. CI always sets it; a laptop without Postgres does
// not have to.
type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");
type CategoriesService = typeof import("./categories");

let db: Db;
let users: Schema["users"];
let workspaces: Schema["workspaces"];
let categoriesService: CategoriesService;

async function loadDeps() {
  const [client, schema, service] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("./categories"),
  ]);
  db = client.db;
  users = schema.users;
  workspaces = schema.workspaces;
  categoriesService = service;
}

function makeTempUser() {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  return {
    id,
    name: `test-user-${suffix}`,
    email: `test-${suffix}@example.com`,
  };
}

async function createTempUser() {
  const user = makeTempUser();
  await db.insert(users).values(user);
  const wsId = crypto.randomUUID();
  await db.insert(workspaces).values({
    id: wsId,
    userId: user.id,
    name: "Personal",
    type: "personal",
    isDefault: true,
  });
  return { ...user, workspaceId: wsId };
}

async function cleanupUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

describe("categories regression", { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" }, () => {
  before(loadDeps);

  it("renaming a default category persists and is not recreated", async () => {
    const user = await createTempUser();

    try {
      const firstSeed = await categoriesService.ensureDefaults(user.id, user.workspaceId);
      assert.ok(firstSeed.inserted > 0, "expected initial default seed");

      const giving = await categoriesService.list(user.id, user.workspaceId, "giving");
      assert.ok(giving.length > 0, "expected seeded giving categories");

      const target = giving.find((c) => c.name === "First Fruits") ?? giving[0];
      const originalName = target.name;
      const renamed = `${originalName} Renamed`;

      await categoriesService.update(user.id, target.id, { name: renamed });

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.id, user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const after = await categoriesService.list(user.id, user.workspaceId, "giving");
      assert.ok(after.some((c) => c.id === target.id && c.name === renamed));
      assert.ok(
        !after.some((c) => c.name === originalName),
        "original default name should not reappear",
      );
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("deleting a default category persists and is not recreated", async () => {
    const user = await createTempUser();

    try {
      await categoriesService.ensureDefaults(user.id, user.workspaceId);

      const giving = await categoriesService.list(user.id, user.workspaceId, "giving");
      assert.ok(giving.length > 0, "expected seeded giving categories");

      const target = giving.find((c) => c.name === "Benevolence") ?? giving[0];
      await categoriesService.remove(user.id, target.id);

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.id, user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const after = await categoriesService.list(user.id, user.workspaceId, "giving");
      assert.ok(!after.some((c) => c.id === target.id));
      assert.ok(
        !after.some((c) => c.name === target.name),
        "deleted default should not reappear",
      );
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("deleting all categories persists empty state", async () => {
    const user = await createTempUser();

    try {
      await categoriesService.ensureDefaults(user.id, user.workspaceId);
      const all = await categoriesService.list(user.id, user.workspaceId);
      assert.ok(all.length > 0, "expected seeded categories");

      for (const category of all) {
        await categoriesService.remove(user.id, category.id);
      }

      const empty = await categoriesService.list(user.id, user.workspaceId);
      assert.strictEqual(empty.length, 0);

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.id, user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const stillEmpty = await categoriesService.list(user.id, user.workspaceId);
      assert.strictEqual(stillEmpty.length, 0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("prevents renaming to an existing category name within same type", async () => {
    const user = await createTempUser();

    try {
      await categoriesService.ensureDefaults(user.id, user.workspaceId);
      const expenses = await categoriesService.list(user.id, user.workspaceId, "expense");
      assert.ok(expenses.length >= 2, "expected at least two expense defaults");

      const [first, second] = expenses;

      await assert.rejects(
        () => categoriesService.update(user.id, second.id, { name: first.name }),
        /already exists/,
      );
    } finally {
      await cleanupUser(user.id);
    }
  });
});
