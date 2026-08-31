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

async function addWorkspace(userId: string, name: string) {
  const id = crypto.randomUUID();
  await db.insert(workspaces).values({
    id,
    userId,
    name,
    type: "business",
    isDefault: false,
  });
  return id;
}

async function cleanupUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

describe("categories regression", { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" }, () => {
  before(loadDeps);

  it("renaming a default category persists and is not recreated", async () => {
    const user = await createTempUser();

    try {
      const firstSeed = await categoriesService.ensureDefaults(user.workspaceId);
      assert.ok(firstSeed.inserted > 0, "expected initial default seed");

      const giving = await categoriesService.list(user.workspaceId, "giving");
      assert.ok(giving.length > 0, "expected seeded giving categories");

      const target = giving.find((c) => c.name === "First Fruits") ?? giving[0];
      const originalName = target.name;
      const renamed = `${originalName} Renamed`;

      await categoriesService.update(user.workspaceId, target.id, { name: renamed });

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const after = await categoriesService.list(user.workspaceId, "giving");
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
      await categoriesService.ensureDefaults(user.workspaceId);

      const giving = await categoriesService.list(user.workspaceId, "giving");
      assert.ok(giving.length > 0, "expected seeded giving categories");

      const target = giving.find((c) => c.name === "Benevolence") ?? giving[0];
      await categoriesService.remove(user.workspaceId, target.id);

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const after = await categoriesService.list(user.workspaceId, "giving");
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
      await categoriesService.ensureDefaults(user.workspaceId);
      const all = await categoriesService.list(user.workspaceId);
      assert.ok(all.length > 0, "expected seeded categories");

      for (const category of all) {
        await categoriesService.remove(user.workspaceId, category.id);
      }

      const empty = await categoriesService.list(user.workspaceId);
      assert.strictEqual(empty.length, 0);

      // Simulate subsequent app bootstrap calls
      const secondSeed = await categoriesService.ensureDefaults(user.workspaceId);
      assert.strictEqual(secondSeed.inserted, 0);

      const stillEmpty = await categoriesService.list(user.workspaceId);
      assert.strictEqual(stillEmpty.length, 0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("prevents renaming to an existing category name within same type", async () => {
    const user = await createTempUser();

    try {
      await categoriesService.ensureDefaults(user.workspaceId);
      const expenses = await categoriesService.list(user.workspaceId, "expense");
      assert.ok(expenses.length >= 2, "expected at least two expense defaults");

      const [first, second] = expenses;

      await assert.rejects(
        () => categoriesService.update(user.workspaceId, second.id, { name: first.name }),
        /already exists/,
      );
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("seeds every workspace, not just the first one", async () => {
    const user = await createTempUser();

    try {
      const business = await addWorkspace(user.id, "Business");

      const personalSeed = await categoriesService.ensureDefaults(user.workspaceId);
      const businessSeed = await categoriesService.ensureDefaults(business);

      assert.ok(personalSeed.inserted > 0, "expected the first workspace to be seeded");
      assert.strictEqual(
        businessSeed.inserted,
        personalSeed.inserted,
        "a second workspace must get its own full set of defaults",
      );

      const personal = await categoriesService.list(user.workspaceId);
      const businessCategories = await categoriesService.list(business);
      assert.strictEqual(businessCategories.length, personal.length);

      // Same names, but they are distinct rows owned by distinct workspaces.
      const overlap = personal.filter((p) =>
        businessCategories.some((b) => b.name === p.name && b.type === p.type),
      );
      assert.ok(overlap.length > 0, "expected the default names to repeat across workspaces");
      assert.strictEqual(
        personal.filter((p) => businessCategories.some((b) => b.id === p.id)).length,
        0,
        "workspaces must not share category rows",
      );
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("keeps the seeded marker per workspace", async () => {
    const user = await createTempUser();

    try {
      const business = await addWorkspace(user.id, "Business");
      await categoriesService.ensureDefaults(user.workspaceId);

      // Emptying one workspace must not make the other look unseeded, and must
      // not resurrect its own defaults.
      for (const category of await categoriesService.list(user.workspaceId)) {
        await categoriesService.remove(user.workspaceId, category.id);
      }
      assert.strictEqual(
        (await categoriesService.ensureDefaults(user.workspaceId)).inserted,
        0,
      );
      assert.strictEqual((await categoriesService.list(user.workspaceId)).length, 0);

      // The untouched workspace still gets its own seed.
      assert.ok((await categoriesService.ensureDefaults(business)).inserted > 0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("allows the same category name in a sibling workspace", async () => {
    const user = await createTempUser();

    try {
      const business = await addWorkspace(user.id, "Business");

      const personal = await categoriesService.create(user.workspaceId, {
        name: "Studio Rent",
        type: "expense",
        color: "#123456",
      });
      assert.ok(personal);

      // Creating the same name in another workspace used to hit the unique
      // index on (user_id, type, name) and fail.
      const sibling = await categoriesService.create(business, {
        name: "Studio Rent",
        type: "expense",
        color: "#123456",
      });
      assert.ok(sibling);
      assert.notStrictEqual(sibling.id, personal.id);

      // Renaming to a name that only exists in the *other* workspace is allowed.
      const spare = await categoriesService.create(user.workspaceId, {
        name: "Equipment",
        type: "expense",
        color: "#654321",
      });
      const renamed = await categoriesService.update(user.workspaceId, spare.id, {
        name: "Kit Hire",
      });
      assert.strictEqual(renamed?.name, "Kit Hire");

      // Renaming to a name taken inside the same workspace is still rejected.
      await assert.rejects(
        () => categoriesService.update(user.workspaceId, spare.id, { name: "Studio Rent" }),
        /already exists/,
      );
    } finally {
      await cleanupUser(user.id);
    }
  });
});
