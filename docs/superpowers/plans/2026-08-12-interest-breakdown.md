# Per-APR Interest Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users record a statement's interest as multiple APR/balance lines (per-APR buckets), stored in the existing `debt_statements.interest_breakdown` jsonb column, with per-bucket derived rates and a blended statement rate.

**Architecture:** Pure bucket helpers live in `lib/debt-interest.ts` alongside `deriveRate`. Zod schemas in `lib/db/validation.ts` validate buckets (accepting camelCase or snake_case keys). The service layer (`lib/db/debt-statements.ts`) normalises breakdowns, derives statement-level `interest_charged` / `balance_subject_to_interest` as sums of the buckets when a split is supplied, and enriches reads with per-bucket rates. API routes accept and return the new field; the close-statement dialog gets an optional "Split by APR" repeater (revolving debts only) and the debt detail history gets a quiet expand affordance.

**Tech Stack:** Next.js 16, React, TypeScript, Drizzle ORM (Postgres), Zod 4, node:test via tsx, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-11-interest-breakdown-design.md` (committed, `9979963`)

## Global Constraints

- No database migration, no backfill. `debt_statements.interest_breakdown` (jsonb) already exists; existing rows stay `null`.
- Buckets are the source of truth when a split is supplied: statement-level `interest_charged` and `balance_subject_to_interest` become sums of bucket fields; disagreeing client totals are overwritten, never an error.
- Empty breakdown array `[]` normalises to `null`. At most **8 buckets** per statement.
- Bucket `label`: trimmed, blank → `null`, max 60 chars (length checked after trimming).
- API accepts camelCase and snake_case for the breakdown field and for bucket fields.
- PATCH: `interestBreakdown: null` clears the split; a new array replaces the whole breakdown (no partial bucket patch).
- Split-entry UI only for revolving debts (`credit_card`, `overdraft`); the API accepts breakdowns for any debt type.
- Do NOT change `deriveRate`'s null-on-zero-basis contract.
- Analytics unchanged: `costOfBorrowing` still sums `interest_charged`.
- Test runner: `node --import tsx --test "lib/**/*.test.ts"`. Integration tests follow the lazy-load, self-skipping pattern of `lib/db/categories.regression.test.ts` (require `DATABASE_URL`; local Postgres runs on port 5432 — **not** 5433/5434).
- Zod 4: `z.number()` already rejects `NaN` and non-finite values.

---

### Task 1: Pure bucket helpers in `lib/debt-interest.ts`

**Files:**
- Modify: `lib/debt-interest.ts` (append after `getRateVariance`, before `RevolvingDebtType`)
- Test: `lib/debt-interest.test.ts` (append new describe blocks)

**Interfaces:**
- Produces (used by Tasks 2–6):
  - `type InterestBucketType = "purchases" | "balance_transfer" | "cash_advance" | "promotional" | "other"`
  - `const INTEREST_BUCKET_TYPES: readonly [InterestBucketType, ...InterestBucketType[]]`
  - `const INTEREST_BUCKET_LABELS: Record<InterestBucketType, string>`
  - `interface InterestBucket { type; label?; balanceSubjectToInterest; interestCharged; apr? }`
  - `const MAX_INTEREST_BUCKETS = 8`
  - `sumInterestBreakdown(buckets) => { interestCharged, balanceSubjectToInterest } | null`
  - `normaliseInterestBreakdown(input) => InterestBucket[] | null`
  - `deriveBucketRate(bucket, periodStart, periodEnd) => DerivedRate | null`

- [ ] **Step 1: Write the failing tests**

Append to `lib/debt-interest.test.ts`, and add the new imports
(`sumInterestBreakdown`, `normaliseInterestBreakdown`, `deriveBucketRate`,
`INTEREST_BUCKET_LABELS`, `InterestBucket`) to the existing import block:

```ts
// ─── sumInterestBreakdown ────────────────────────────────────────────────────

describe("sumInterestBreakdown", () => {
  it("returns null for null, undefined, or an empty array", () => {
    assert.strictEqual(sumInterestBreakdown(null), null);
    assert.strictEqual(sumInterestBreakdown(undefined), null);
    assert.strictEqual(sumInterestBreakdown([]), null);
  });

  it("sums interest and bases across buckets", () => {
    const sums = sumInterestBreakdown([
      { type: "balance_transfer", balanceSubjectToInterest: 2000, interestCharged: 0 },
      { type: "purchases", balanceSubjectToInterest: 500, interestCharged: 10.5 },
    ]);
    assert.deepStrictEqual(sums, {
      interestCharged: 10.5,
      balanceSubjectToInterest: 2500,
    });
  });

  it("rounds float drift to 2dp", () => {
    const sums = sumInterestBreakdown([
      { type: "purchases", balanceSubjectToInterest: 0.1, interestCharged: 0.1 },
      { type: "other", balanceSubjectToInterest: 0.2, interestCharged: 0.2 },
    ]);
    assert.deepStrictEqual(sums, {
      interestCharged: 0.3,
      balanceSubjectToInterest: 0.3,
    });
  });
});

// ─── normaliseInterestBreakdown ─────────────────────────────────────────────

describe("normaliseInterestBreakdown", () => {
  it("returns null for null, undefined, or an empty array", () => {
    assert.strictEqual(normaliseInterestBreakdown(null), null);
    assert.strictEqual(normaliseInterestBreakdown(undefined), null);
    assert.strictEqual(normaliseInterestBreakdown([]), null);
  });

  it("trims labels and maps blank labels to null", () => {
    const buckets = normaliseInterestBreakdown([
      {
        type: "balance_transfer",
        label: "  0% until March  ",
        balanceSubjectToInterest: 2000,
        interestCharged: 0,
      },
      {
        type: "purchases",
        label: "   ",
        balanceSubjectToInterest: 500,
        interestCharged: 10,
      },
      { type: "other", balanceSubjectToInterest: 100, interestCharged: 2 },
    ]);
    assert.ok(buckets);
    assert.strictEqual(buckets[0].label, "0% until March");
    assert.strictEqual(buckets[1].label, null);
    assert.strictEqual(buckets[2].label, null);
  });
});

// ─── deriveBucketRate ────────────────────────────────────────────────────────

describe("deriveBucketRate", () => {
  it("derives an exact rate from the printed bucket basis", () => {
    const rate = deriveBucketRate(
      { balanceSubjectToInterest: 1000, interestCharged: 15 },
      "2026-05-01",
      "2026-05-31",
    );
    assert.ok(rate);
    assert.strictEqual(rate.estimated, false);
    assert.strictEqual(rate.basis, 1000);
    assert.ok(Math.abs(rate.periodRatePercent - 1.5) < 1e-9);
  });

  it("returns a real 0% rate for zero basis and zero interest (0% promo)", () => {
    const rate = deriveBucketRate(
      { balanceSubjectToInterest: 0, interestCharged: 0 },
      "2026-05-01",
      "2026-05-31",
    );
    assert.deepStrictEqual(rate, {
      periodRatePercent: 0,
      annualisedPercent: 0,
      basis: 0,
      estimated: false,
      periodDays: 31,
    });
  });

  it("returns null for zero basis with positive interest (meaningless)", () => {
    assert.strictEqual(
      deriveBucketRate(
        { balanceSubjectToInterest: 0, interestCharged: 5 },
        "2026-05-01",
        "2026-05-31",
      ),
      null,
    );
  });

  it("returns null for a broken period", () => {
    assert.strictEqual(
      deriveBucketRate(
        { balanceSubjectToInterest: 1000, interestCharged: 15 },
        "nonsense",
        "2026-05-31",
      ),
      null,
    );
  });

  it("blended rate over summed totals matches deriveRate on the sums", () => {
    const buckets: InterestBucket[] = [
      { type: "balance_transfer", balanceSubjectToInterest: 2000, interestCharged: 0 },
      { type: "purchases", balanceSubjectToInterest: 500, interestCharged: 10 },
    ];
    const sums = sumInterestBreakdown(buckets)!;
    const blended = deriveRate({
      openingBalance: 0,
      closingBalance: 0,
      interestCharged: sums.interestCharged,
      balanceSubjectToInterest: sums.balanceSubjectToInterest,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(blended);
    assert.strictEqual(blended.estimated, false);
    assert.ok(Math.abs(blended.periodRatePercent - 0.4) < 1e-9);
  });

  it("per-bucket variance uses the bucket APR; null APR gives null variance", () => {
    const rate = deriveBucketRate(
      { balanceSubjectToInterest: 1000, interestCharged: 15 },
      "2026-05-01",
      "2026-05-31",
    );
    const variance = getRateVariance(rate, 18);
    assert.ok(variance !== null && variance > 0);
    assert.strictEqual(getRateVariance(rate, null), null);
  });
});

describe("INTEREST_BUCKET_LABELS", () => {
  it("has a label for every bucket type", () => {
    assert.strictEqual(INTEREST_BUCKET_LABELS.purchases, "Purchases");
    assert.strictEqual(INTEREST_BUCKET_LABELS.balance_transfer, "Balance transfer");
    assert.strictEqual(INTEREST_BUCKET_LABELS.cash_advance, "Cash advance");
    assert.strictEqual(INTEREST_BUCKET_LABELS.promotional, "Promotional");
    assert.strictEqual(INTEREST_BUCKET_LABELS.other, "Other");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/debt-interest.test.ts 2>&1 | tail -5`
Expected: FAIL — `sumInterestBreakdown is not a function` / import error.

- [ ] **Step 3: Implement the helpers**

Insert into `lib/debt-interest.ts` immediately after `getRateVariance` (line 103),
before `export type RevolvingDebtType`:

```ts
// ─── Per-APR interest buckets ────────────────────────────────────────────────
//
// A statement can carry several APR lines at once (a 0% balance transfer next
// to purchases at 24.9%). Each line is a bucket; when buckets are present they
// are the source of truth and the statement-level interest and basis are their
// sums.

export type InterestBucketType =
  | "purchases"
  | "balance_transfer"
  | "cash_advance"
  | "promotional"
  | "other";

/** Zod needs a mutable tuple; the readonly alias is for general use. */
export const INTEREST_BUCKET_TYPES: [
  InterestBucketType,
  ...InterestBucketType[],
] = ["purchases", "balance_transfer", "cash_advance", "promotional", "other"];

export const INTEREST_BUCKET_LABELS: Record<InterestBucketType, string> = {
  purchases: "Purchases",
  balance_transfer: "Balance transfer",
  cash_advance: "Cash advance",
  promotional: "Promotional",
  other: "Other",
};

/** Hard cap so the jsonb column cannot grow without bound. */
export const MAX_INTEREST_BUCKETS = 8;

export interface InterestBucket {
  type: InterestBucketType;
  /** Free-text override of the preset name; null uses the type's label. */
  label?: string | null;
  /** The balance the issuer charged interest against for this line. */
  balanceSubjectToInterest: number;
  interestCharged: number;
  /** Advertised APR for this line, percent. */
  apr?: number | null;
}

/**
 * Statement-level totals implied by a split, or null when there is no split.
 * When buckets exist they are the source of truth: the statement's
 * `interest_charged` and `balance_subject_to_interest` columns are these sums.
 */
export function sumInterestBreakdown(
  buckets: InterestBucket[] | null | undefined,
): { interestCharged: number; balanceSubjectToInterest: number } | null {
  if (!buckets || buckets.length === 0) return null;
  return {
    interestCharged: round2(
      buckets.reduce((sum, b) => sum + b.interestCharged, 0),
    ),
    balanceSubjectToInterest: round2(
      buckets.reduce((sum, b) => sum + b.balanceSubjectToInterest, 0),
    ),
  };
}

/**
 * Canonical stored form of a breakdown: null when there is no split, otherwise
 * the buckets with labels trimmed and blank labels nulled. Assumes the input
 * has already passed validation (`lib/db/validation.ts`).
 */
export function normaliseInterestBreakdown(
  input: InterestBucket[] | null | undefined,
): InterestBucket[] | null {
  if (!input || input.length === 0) return null;
  return input.map((bucket) => ({
    type: bucket.type,
    label: bucket.label?.trim() ? bucket.label.trim() : null,
    balanceSubjectToInterest: bucket.balanceSubjectToInterest,
    interestCharged: bucket.interestCharged,
    apr: bucket.apr ?? null,
  }));
}

/**
 * The rate one APR line implies, using the line's printed basis so the result
 * is always exact, never a midpoint estimate.
 *
 * Unlike a whole statement, a zero basis is not automatically meaningless: a
 * 0% promotional line with nothing yet subject to interest is a real 0%
 * answer. Zero basis with interest actually charged is nonsense and stays
 * null, as does a broken period.
 */
export function deriveBucketRate(
  bucket: Pick<InterestBucket, "balanceSubjectToInterest" | "interestCharged">,
  periodStart: string,
  periodEnd: string,
): DerivedRate | null {
  const periodDays = getPeriodDays(periodStart, periodEnd);
  if (periodDays <= 0) return null;

  if (!(bucket.balanceSubjectToInterest > 0)) {
    if (bucket.interestCharged === 0) {
      return {
        periodRatePercent: 0,
        annualisedPercent: 0,
        basis: 0,
        estimated: false,
        periodDays,
      };
    }
    return null;
  }

  // A printed basis makes the midpoint inputs irrelevant; deriveRate's own
  // null-on-zero-basis contract is unchanged and still governs statements.
  return deriveRate({
    openingBalance: 0,
    closingBalance: 0,
    interestCharged: bucket.interestCharged,
    balanceSubjectToInterest: bucket.balanceSubjectToInterest,
    periodStart,
    periodEnd,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/debt-interest.test.ts 2>&1 | tail -8`
Expected: PASS, all suites green (0 fail).

- [ ] **Step 5: Commit**

```bash
git add lib/debt-interest.ts lib/debt-interest.test.ts
git commit -m "feat(debts): pure helpers for per-APR interest buckets"
```

---

### Task 2: Bucket validation schemas

**Files:**
- Modify: `lib/db/validation.ts` (add bucket schema before `debtStatementFields`, wire into create + update)
- Test: `lib/db/validation.test.ts` (append describe block; extend the import list)

**Interfaces:**
- Consumes: `INTEREST_BUCKET_TYPES`, `MAX_INTEREST_BUCKETS` from `@/lib/debt-interest` (Task 1).
- Produces:
  - `interestBucketSchema` (exported for tests)
  - `debtStatementCreateSchema` / `debtStatementUpdateSchema` accept optional/nullable `interestBreakdown`; parsed output is camelCase `InterestBucket[] | null | undefined`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/db/validation.test.ts` (add `debtStatementCreateSchema`,
`debtStatementUpdateSchema` to the imports from `"./validation"`):

```ts
// ─── Debt statement interest breakdown ───────────────────────────────────────

const validStatement = {
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  statementDate: "2026-05-31",
  openingBalance: 1000,
  closingBalance: 900,
};

const btBucket = {
  type: "balance_transfer",
  balanceSubjectToInterest: 2000,
  interestCharged: 0,
  apr: 0,
};

describe("debtStatementCreateSchema interestBreakdown", () => {
  it("accepts a statement without a breakdown", () => {
    const parsed = debtStatementCreateSchema.parse(validStatement);
    assert.strictEqual(parsed.interestBreakdown, undefined);
  });

  it("accepts a valid breakdown", () => {
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interestBreakdown: [
        btBucket,
        {
          type: "purchases",
          label: "Everyday spend",
          balanceSubjectToInterest: 500,
          interestCharged: 10.5,
        },
      ],
    });
    assert.strictEqual(parsed.interestBreakdown?.length, 2);
  });

  it("accepts snake_case bucket keys and normalises them to camelCase", () => {
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interest_breakdown: undefined, // absent either way
      interestBreakdown: [
        {
          type: "purchases",
          balance_subject_to_interest: 500,
          interest_charged: 10.5,
        },
      ],
    });
    assert.deepStrictEqual(parsed.interestBreakdown?.[0], {
      type: "purchases",
      balanceSubjectToInterest: 500,
      interestCharged: 10.5,
    });
  });

  it("rejects a bad bucket type", () => {
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          { type: "mortgage", balanceSubjectToInterest: 1, interestCharged: 1 },
        ],
      }),
    );
  });

  it("rejects negative and non-finite bucket figures", () => {
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          { type: "purchases", balanceSubjectToInterest: -1, interestCharged: 1 },
        ],
      }),
    );
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          {
            type: "purchases",
            balanceSubjectToInterest: 100,
            interestCharged: Number.POSITIVE_INFINITY,
          },
        ],
      }),
    );
  });

  it("rejects more than 8 buckets", () => {
    const bucket = { type: "other", balanceSubjectToInterest: 1, interestCharged: 1 };
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: Array.from({ length: 9 }, () => bucket),
      }),
    );
    assert.doesNotThrow(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: Array.from({ length: 8 }, () => bucket),
      }),
    );
  });

  it("trims labels before the 60-char limit and rejects overlong ones", () => {
    const padded = `${"x".repeat(59)}   `;
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interestBreakdown: [
        { type: "other", label: padded, balanceSubjectToInterest: 1, interestCharged: 1 },
      ],
    });
    assert.strictEqual(parsed.interestBreakdown?.[0].label, "x".repeat(59));

    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          {
            type: "other",
            label: "x".repeat(61),
            balanceSubjectToInterest: 1,
            interestCharged: 1,
          },
        ],
      }),
    );
  });

  it("update schema distinguishes omitted, null (clear), and replace", () => {
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ notes: "x" }).interestBreakdown,
      undefined,
    );
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ interestBreakdown: null }).interestBreakdown,
      null,
    );
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ interestBreakdown: [btBucket] })
        .interestBreakdown?.length,
      1,
    );
    // An empty patch is still rejected
    assert.throws(() => debtStatementUpdateSchema.parse({}));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/db/validation.test.ts 2>&1 | tail -5`
Expected: FAIL — `parsed.interestBreakdown` is undefined / schema strips the key.

- [ ] **Step 3: Add the schemas**

In `lib/db/validation.ts`, import the constants at the top (after the `zod` import):

```ts
import { INTEREST_BUCKET_TYPES, MAX_INTEREST_BUCKETS } from "@/lib/debt-interest";
```

Insert before `const debtStatementFields` (line 366):

```ts
// ─── Per-APR interest buckets ────────────────────────────────────────────────
//
// A statement may carry several APR lines (0% balance transfer next to
// purchases). Buckets accept camelCase or snake_case keys, matching the
// statement routes' convention of accepting both for top-level fields.

export const interestBucketSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      return {
        type: v.type,
        label: v.label,
        balanceSubjectToInterest:
          v.balanceSubjectToInterest ?? v.balance_subject_to_interest,
        interestCharged: v.interestCharged ?? v.interest_charged,
        apr: v.apr,
      };
    }
    return value;
  },
  z.object({
    type: z.enum(INTEREST_BUCKET_TYPES),
    // Trim before the length check so trailing space cannot reject a label.
    label: z.string().trim().max(60).nullish(),
    balanceSubjectToInterest: z.number().min(0),
    interestCharged: z.number().min(0),
    apr: z.number().min(0).nullish(),
  }),
);

const interestBreakdownSchema = z
  .array(interestBucketSchema)
  .max(MAX_INTEREST_BUCKETS)
  .nullish();
```

Add to `debtStatementFields` (after `balanceSubjectToInterest`):

```ts
  interestBreakdown: interestBreakdownSchema,
```

Add the same line to `debtStatementUpdateSchema`'s object (after its
`balanceSubjectToInterest` line). The update schema's "at least one field"
refine already counts `interestBreakdown` because it is a value in `data`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/db/validation.test.ts 2>&1 | tail -8`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/db/validation.ts lib/db/validation.test.ts
git commit -m "feat(debts): validate interest breakdown buckets on statement schemas"
```

---

### Task 3: Service layer — persist sums, enrich reads

**Files:**
- Modify: `db/schema.ts:512` (type the jsonb column)
- Modify: `lib/db/debt-statements.ts` (`StatementInput`, create, update, list)
- Test: `lib/db/debt-statements.regression.test.ts` (create — integration, self-skips without `DATABASE_URL`)

**Interfaces:**
- Consumes: `InterestBucket`, `normaliseInterestBreakdown`, `sumInterestBreakdown`, `deriveBucketRate`, `getRateVariance` from `@/lib/debt-interest` (Task 1); extended schemas (Task 2).
- Produces: `listStatements` rows gain
  `interestBreakdown: Array<InterestBucket & { label: string | null; apr: number | null; rate: DerivedRate | null; rateVariance: number | null }> | null`
  (consumed by Task 4's `toStatement`).

- [ ] **Step 1: Type the column in `db/schema.ts`**

Add at the top of `db/schema.ts` (type-only, no runtime cycle):

```ts
import type { InterestBucket } from "@/lib/debt-interest";
```

Change line 512 from:

```ts
    interestBreakdown: jsonb("interest_breakdown"), // reserved for per-APR buckets
```

to:

```ts
    // Per-APR buckets; when present, interest/basis columns are the bucket sums.
    interestBreakdown: jsonb("interest_breakdown").$type<InterestBucket[]>(),
```

- [ ] **Step 2: Write the failing integration tests**

Create `lib/db/debt-statements.regression.test.ts`:

```ts
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
            // @ts-expect-error deliberately invalid type
            interestBreakdown: [
              { type: "mortgage", balanceSubjectToInterest: 1, interestCharged: 1 },
            ],
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
        assert.strictEqual(bt.rateVariance, -0); // 0 - apr 0
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `DATABASE_URL=$(grep '^DATABASE_URL' .env.local | cut -d= -f2-) node --import tsx --test lib/db/debt-statements.regression.test.ts 2>&1 | tail -8`
Expected: FAIL — `interestBreakdown` not accepted / not stored.

- [ ] **Step 4: Implement the service changes**

In `lib/db/debt-statements.ts`:

4a. Extend the `@/lib/debt-interest` import:

```ts
import {
  deriveRate,
  deriveBucketRate,
  forecastMinimumPayment,
  getPaymentWindowStart,
  getRateVariance,
  getStatementResidual,
  isResidualSignificant,
  isRevolvingDebt,
  normaliseInterestBreakdown,
  sumInterestBreakdown,
  type InterestBucket,
} from "@/lib/debt-interest";
```

4b. Add to `StatementInput` (after `balanceSubjectToInterest`):

```ts
  interestBreakdown?: InterestBucket[] | null;
```

4c. Add an enriched row type after `PaymentInput`:

```ts
/** A stored bucket enriched with the rate it implies for the statement period. */
export interface EnrichedInterestBucket extends InterestBucket {
  label: string | null;
  apr: number | null;
  rate: ReturnType<typeof deriveBucketRate>;
  rateVariance: number | null;
}
```

4d. In `createStatement`, after the `assertOwnership` line, add:

```ts
  const breakdown = normaliseInterestBreakdown(parsed.interestBreakdown);
  // When a split is supplied the buckets are the source of truth: statement
  // totals are their sums, whatever the client sent.
  const sums = breakdown ? sumInterestBreakdown(breakdown) : null;
```

and change the insert values:

```ts
        interestCharged: String(sums?.interestCharged ?? parsed.interestCharged),
```

```ts
        balanceSubjectToInterest:
          sums != null
            ? String(sums.balanceSubjectToInterest)
            : parsed.balanceSubjectToInterest != null
              ? String(parsed.balanceSubjectToInterest)
              : null,
        interestBreakdown: breakdown,
```

4e. In `updateStatement`, after the period-merge check, add:

```ts
  const breakdownProvided = parsed.interestBreakdown !== undefined;
  const breakdown = breakdownProvided
    ? normaliseInterestBreakdown(parsed.interestBreakdown)
    : undefined;
  const sums = breakdown ? sumInterestBreakdown(breakdown) : null;
```

and in the `.set({...})` object add (order matters — these spread AFTER the
plain `interestCharged` / `balanceSubjectToInterest` spreads so sums win when a
split is supplied):

```ts
        ...(breakdownProvided && { interestBreakdown: breakdown ?? null }),
        ...(sums != null && { interestCharged: String(sums.interestCharged) }),
        ...(sums != null && {
          balanceSubjectToInterest: String(sums.balanceSubjectToInterest),
        }),
```

4f. In `listStatements`, inside the `rows.map` callback after `residual` is
computed, add:

```ts
    const interestBreakdown: EnrichedInterestBucket[] | null =
      row.interestBreakdown?.map((bucket) => {
        const bucketRate = deriveBucketRate(bucket, row.periodStart, row.periodEnd);
        return {
          ...bucket,
          label: bucket.label ?? null,
          apr: bucket.apr ?? null,
          rate: bucketRate,
          rateVariance: getRateVariance(bucketRate, bucket.apr),
        };
      }) ?? null;
```

and add `interestBreakdown,` to the returned object (after `interestPaid`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `DATABASE_URL=$(grep '^DATABASE_URL' .env.local | cut -d= -f2-) node --import tsx --test lib/db/debt-statements.regression.test.ts 2>&1 | tail -8`
Expected: PASS, 6 tests, 0 fail. Then run the whole suite to check for regressions:
`DATABASE_URL=$(grep '^DATABASE_URL' .env.local | cut -d= -f2-) npm test 2>&1 | tail -8`

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts lib/db/debt-statements.ts lib/db/debt-statements.regression.test.ts
git commit -m "feat(debts): persist interest breakdown with sum-derived totals"
```

---

### Task 4: API routes and shared types

**Files:**
- Modify: `app/api/debts-credits/[id]/statements/route.ts` (POST body field; GET mapping)
- Modify: `app/api/debts-credits/[id]/statements/[statementId]/route.ts` (PATCH body field)
- Modify: `types/index.ts:218-251` (`ApiInterestBucket`, `ApiDebtStatement.interest_breakdown`)

**Interfaces:**
- Consumes: enriched `listStatements` rows (Task 3).
- Produces: `ApiDebtStatement.interest_breakdown: ApiInterestBucket[] | null` where
  `ApiInterestBucket = { type; label; balance_subject_to_interest; interest_charged; apr; rate: ApiDerivedRate | null; rate_variance: number | null }` (used by Tasks 5–6).

- [ ] **Step 1: Update `types/index.ts`**

After `ApiDerivedRate`, before `ApiDebtStatement`, add:

```ts
export type InterestBucketType =
  | 'purchases'
  | 'balance_transfer'
  | 'cash_advance'
  | 'promotional'
  | 'other'

/** One APR line of a statement's interest breakdown, with the rate it implies. */
export interface ApiInterestBucket {
  type: InterestBucketType
  label: string | null
  balance_subject_to_interest: number
  interest_charged: number
  apr: number | null
  rate: ApiDerivedRate | null
  rate_variance: number | null
}
```

Add to `ApiDebtStatement` after `rate`:

```ts
  /** Per-APR split; when present, interest_charged/balance_subject_to_interest are its sums. */
  interest_breakdown: ApiInterestBucket[] | null
```

- [ ] **Step 2: Update the statements collection route**

In `app/api/debts-credits/[id]/statements/route.ts`:

2a. Add to `toStatement` after the `rate` block (before `created_at`):

```ts
    interest_breakdown:
      row.interestBreakdown?.map((bucket) => ({
        type: bucket.type,
        label: bucket.label,
        balance_subject_to_interest: bucket.balanceSubjectToInterest,
        interest_charged: bucket.interestCharged,
        apr: bucket.apr,
        rate: bucket.rate && {
          period_rate_percent: bucket.rate.periodRatePercent,
          annualised_percent: bucket.rate.annualisedPercent,
          basis: bucket.rate.basis,
          estimated: bucket.rate.estimated,
          period_days: bucket.rate.periodDays,
        },
        rate_variance: bucket.rateVariance,
      })) ?? null,
```

2b. In POST, add after the `balanceSubjectToInterest` body pick:

```ts
      interestBreakdown: body.interestBreakdown ?? body.interest_breakdown,
```

- [ ] **Step 3: Update the statement detail route**

In `app/api/debts-credits/[id]/statements/[statementId]/route.ts`, add to the
PATCH body mapping after the `balanceSubjectToInterest` block. The existing
`pick` helper returns `null` (not `undefined`) for an explicit JSON null, so a
`null` here correctly reaches the service as a clear:

```ts
      ...(pick(body.interestBreakdown, body.interest_breakdown) !== undefined && {
        interestBreakdown: pick(body.interestBreakdown, body.interest_breakdown),
      }),
```

- [ ] **Step 4: Verify with typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors.

Manual API check (dev server + seeded card): POST a statement with
`interest_breakdown` using snake_case bucket keys → GET → response shows
`interest_breakdown` with per-bucket `rate` / `rate_variance`, and statement
`interest_charged` equals the bucket sum.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts "app/api/debts-credits/[id]/statements/route.ts" "app/api/debts-credits/[id]/statements/[statementId]/route.ts"
git commit -m "feat(debts): accept and return interest breakdown on statement routes"
```

---

### Task 5: Statement dialog — "Split by APR" entry

**Files:**
- Modify: `components/dashboard/debts/statement-dialog.tsx`

**Interfaces:**
- Consumes: `InterestBucketType`, `INTEREST_BUCKET_TYPES`, `INTEREST_BUCKET_LABELS`, `MAX_INTEREST_BUCKETS`, `deriveBucketRate`, `getRateVariance` from `@/lib/debt-interest`; POST field `interestBreakdown` (Task 4).
- Produces: POST body `{ interestBreakdown: [{ type, label, balanceSubjectToInterest, interestCharged, apr }] }` when split is on; omits it otherwise.

- [ ] **Step 1: Add bucket form state**

Add imports: `Plus`, `X` from `lucide-react`; the Select primitives from
`@/components/ui/select`; and from `@/lib/debt-interest`:

```ts
import {
  deriveRate,
  deriveBucketRate,
  getRateVariance,
  getStatementResidual,
  isResidualSignificant,
  INTEREST_BUCKET_LABELS,
  INTEREST_BUCKET_TYPES,
  MAX_INTEREST_BUCKETS,
  type InterestBucketType,
} from "@/lib/debt-interest";
```

Add state and helpers inside `StatementDialog`:

```ts
  interface BucketForm {
    type: InterestBucketType;
    label: string;
    balanceSubjectToInterest: string;
    interestCharged: string;
    apr: string;
  }

  const emptyBucket = (): BucketForm => ({
    type: "purchases",
    label: "",
    balanceSubjectToInterest: "",
    interestCharged: "",
    apr: "",
  });

  const [split, setSplit] = useState(false);
  const [buckets, setBuckets] = useState<BucketForm[]>([emptyBucket()]);

  const setBucket = (index: number, patch: Partial<BucketForm>) =>
    setBuckets((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const bucketSums = useMemo(() => {
    if (!split) return null;
    let interest = 0;
    let basis = 0;
    for (const b of buckets) {
      interest += toNumber(b.interestCharged) ?? 0;
      basis += toNumber(b.balanceSubjectToInterest) ?? 0;
    }
    return {
      interest: Math.round(interest * 100) / 100,
      basis: Math.round(basis * 100) / 100,
    };
  }, [split, buckets]);
```

(The `BucketForm` interface and `emptyBucket` can be hoisted outside the
component to avoid re-creating them per render.)

- [ ] **Step 2: Feed split totals into the existing preview**

In the `preview` `useMemo`, replace the two lines reading `interest` and the
`balanceSubjectToInterest` passed to `deriveRate`:

```ts
    const interest = split
      ? (bucketSums?.interest ?? 0)
      : (toNumber(form.interestCharged) ?? 0);
```

```ts
        balanceSubjectToInterest: split
          ? (bucketSums?.basis ?? null)
          : toNumber(form.balanceSubjectToInterest),
```

Add `split` and `bucketSums` to the `useMemo` dependency array.

- [ ] **Step 3: Render the split control and repeater**

Replace the Interest field block (the `st-interest` `div`) with:

```tsx
            <div className="space-y-2">
              <Label htmlFor="st-interest">Interest charged</Label>
              <Input
                id="st-interest"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={split ? String(bucketSums?.interest ?? 0) : form.interestCharged}
                onChange={(e) => set({ interestCharged: e.target.value })}
                readOnly={split}
                aria-readonly={split}
                className={split ? "bg-sunken text-muted-foreground" : undefined}
              />
              {split && (
                <p className="text-[11.5px] text-muted-foreground">
                  Total of the APR lines below
                </p>
              )}
            </div>
```

Add the toggle link directly under the Interest/minimum grid (as a sibling
after that `grid grid-cols-2` div), revolving debts only:

```tsx
          {isRevolving && !split && (
            <button
              type="button"
              onClick={() => setSplit(true)}
              className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Split by APR — a 0% balance transfer next to purchases, for example
            </button>
          )}

          {isRevolving && split && (
            <div className="space-y-3 rounded-2xl border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium">Interest by APR line</p>
                <button
                  type="button"
                  onClick={() => {
                    setSplit(false);
                    setBuckets([emptyBucket()]);
                  }}
                  className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Use single total
                </button>
              </div>

              {buckets.map((bucket, index) => {
                const basis = toNumber(bucket.balanceSubjectToInterest);
                const interest = toNumber(bucket.interestCharged);
                const apr = toNumber(bucket.apr);
                const rate =
                  basis != null && interest != null && form.periodStart && form.periodEnd
                    ? deriveBucketRate(
                        { balanceSubjectToInterest: basis, interestCharged: interest },
                        form.periodStart,
                        form.periodEnd,
                      )
                    : null;
                const variance = getRateVariance(rate, apr);
                return (
                  <div key={index} className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      <Select
                        value={bucket.type}
                        onValueChange={(value) =>
                          setBucket(index, { type: value as InterestBucketType })
                        }
                      >
                        <SelectTrigger aria-label={`APR line ${index + 1} type`} className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INTEREST_BUCKET_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {INTEREST_BUCKET_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground"
                        aria-label={`Remove APR line ${index + 1}`}
                        disabled={buckets.length === 1}
                        onClick={() =>
                          setBuckets((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Label (optional)"
                      aria-label={`APR line ${index + 1} label`}
                      maxLength={60}
                      value={bucket.label}
                      onChange={(e) => setBucket(index, { label: e.target.value })}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number" min="0" step="0.01" placeholder="Balance"
                        aria-label={`APR line ${index + 1} balance subject to interest`}
                        value={bucket.balanceSubjectToInterest}
                        onChange={(e) =>
                          setBucket(index, { balanceSubjectToInterest: e.target.value })
                        }
                      />
                      <Input
                        type="number" min="0" step="0.01" placeholder="Interest"
                        aria-label={`APR line ${index + 1} interest charged`}
                        value={bucket.interestCharged}
                        onChange={(e) =>
                          setBucket(index, { interestCharged: e.target.value })
                        }
                      />
                      <Input
                        type="number" min="0" step="0.01" placeholder="APR %"
                        aria-label={`APR line ${index + 1} APR`}
                        value={bucket.apr}
                        onChange={(e) => setBucket(index, { apr: e.target.value })}
                      />
                    </div>
                    {rate && (
                      <p className="text-[11.5px] tabular-nums text-muted-foreground">
                        {bucket.label.trim() || INTEREST_BUCKET_LABELS[bucket.type]} ·{" "}
                        {rate.annualisedPercent.toFixed(1)}% a year
                        {variance != null && Math.abs(variance) >= 1 && (
                          <span className="ml-1 text-obligation">
                            ({variance > 0 ? "+" : ""}
                            {variance.toFixed(1)}pts vs {apr}%)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={buckets.length >= MAX_INTEREST_BUCKETS}
                onClick={() => setBuckets((prev) => [...prev, emptyBucket()])}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add line
              </Button>
            </div>
          )}
```

In the "More fields" section, make the basis input read-only while split is on
(same treatment as Interest):

```tsx
                <Input
                  id="st-basis"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={split ? String(bucketSums?.basis ?? 0) : form.balanceSubjectToInterest}
                  onChange={(e) => set({ balanceSubjectToInterest: e.target.value })}
                  readOnly={split}
                  aria-readonly={split}
                  className={split ? "bg-sunken text-muted-foreground" : undefined}
                />
```

- [ ] **Step 4: Validate and submit the breakdown**

In `handleSubmit`, after the opening/closing check, add:

```ts
    let interestBreakdown: unknown;
    if (split) {
      const parsed = [];
      for (const [index, bucket] of buckets.entries()) {
        const basis = toNumber(bucket.balanceSubjectToInterest);
        const interest = toNumber(bucket.interestCharged);
        if (basis == null || basis < 0 || interest == null || interest < 0) {
          toast({
            title: "Error",
            description: `APR line ${index + 1} needs a balance and an interest figure`,
            variant: "destructive",
          });
          return;
        }
        parsed.push({
          type: bucket.type,
          label: bucket.label.trim() || null,
          balanceSubjectToInterest: basis,
          interestCharged: interest,
          apr: toNumber(bucket.apr),
        });
      }
      interestBreakdown = parsed;
    }
```

In the POST body add `interestBreakdown,` (shorthand — `undefined` keys are
dropped by `JSON.stringify`, so the single-total flow sends nothing new), and
send the summed totals for consistency (the server re-derives them anyway):

```ts
          interestCharged: split
            ? (bucketSums?.interest ?? 0)
            : (toNumber(form.interestCharged) ?? 0),
```

```ts
          balanceSubjectToInterest: split
            ? (bucketSums?.basis ?? null)
            : toNumber(form.balanceSubjectToInterest),
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | head -20` — no errors.
Run: `npm run lint 2>&1 | tail -5` — no errors.

Manual check (dev server): on a credit card, open Close statement → "Split by
APR" → 0% balance transfer line + purchases line → totals become read-only sums
→ per-line preview shows annualised % and variance → save → GET shows the
breakdown. On a loan, no split control appears and the dialog is unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/debts/statement-dialog.tsx
git commit -m "feat(debts): split-by-APR entry in the close-statement dialog"
```

---

### Task 6: Debt detail — expandable per-bucket view

**Files:**
- Modify: `components/dashboard/debts/debt-detail.tsx`

**Interfaces:**
- Consumes: `ApiDebtStatement.interest_breakdown` (Task 4), `INTEREST_BUCKET_LABELS` from `@/lib/debt-interest`.

- [ ] **Step 1: Add expand state and imports**

Add `ChevronDown` to the lucide imports and `INTEREST_BUCKET_LABELS` to the
`@/lib/debt-interest` import. Add state inside `DebtDetail`:

```ts
  const [expandedStatements, setExpandedStatements] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) =>
    setExpandedStatements((prev) => ({ ...prev, [id]: !prev[id] }));
```

- [ ] **Step 2: Add the expand affordance**

In the statement row, inside the delete-button `span` (line 312's
`col-span-2 flex justify-end sm:col-auto`), render before the delete `Button`,
only when the statement has a breakdown:

```tsx
                            {statement.interest_breakdown && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground"
                                aria-label={`${expandedStatements[statement.id] ? "Hide" : "Show"} APR lines for ${formatPeriod(statement.period_start, statement.period_end)}`}
                                aria-expanded={!!expandedStatements[statement.id]}
                                onClick={() => toggleExpanded(statement.id)}
                              >
                                <ChevronDown
                                  className={`size-3.5 transition-transform ${expandedStatements[statement.id] ? "rotate-180" : ""}`}
                                />
                              </Button>
                            )}
```

Also show a "N rates" hint in the mobile restatement line (inside the
`sm:hidden` paragraph, appended after the minimum fragment):

```tsx
                            {statement.interest_breakdown &&
                              ` · ${statement.interest_breakdown.length} rates`}
```

- [ ] **Step 3: Render the expanded bucket lines**

Still inside the statement `li`, after the mobile restatement / variance /
residual block's wrapping `div` closes (i.e. as a new sibling under the outer
grid container, before `</li>`), add:

```tsx
                        {statement.interest_breakdown &&
                          expandedStatements[statement.id] && (
                            <ul className="col-span-2 space-y-1 border-t border-border/40 pt-2">
                              {statement.interest_breakdown.map((bucket, index) => (
                                <li
                                  key={index}
                                  className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] tabular-nums text-muted-foreground"
                                >
                                  <span className="font-medium text-foreground">
                                    {bucket.label ?? INTEREST_BUCKET_LABELS[bucket.type]}
                                  </span>
                                  <span>
                                    {formatCurrency(bucket.interest_charged)} interest on{" "}
                                    {formatCurrency(bucket.balance_subject_to_interest)}
                                  </span>
                                  {bucket.rate && (
                                    <span>
                                      · {bucket.rate.annualised_percent.toFixed(1)}% a year
                                    </span>
                                  )}
                                  {bucket.apr != null && <span>· {bucket.apr}% APR</span>}
                                  {bucket.rate_variance != null &&
                                    Math.abs(bucket.rate_variance) >= 1 && (
                                      <span className="text-obligation">
                                        ({bucket.rate_variance > 0 ? "+" : ""}
                                        {bucket.rate_variance.toFixed(1)}pts)
                                      </span>
                                    )}
                                </li>
                              ))}
                            </ul>
                          )}
```

The outer row container is already a `grid` whose children span `col-span-2`,
so this stacks compactly on mobile and desktop alike with no extra chrome.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | head -20` and `npm run lint 2>&1 | tail -5` — clean.

Manual check: statement list rows stay compact; a split statement shows the
chevron; expanding lists each line with name, interest, basis, annualised %,
APR, and ≥1pt variance; a statement without a split shows no new chrome;
mobile width stacks the lines legibly.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/debts/debt-detail.tsx
git commit -m "feat(debts): expandable per-APR lines in statement history"
```

---

### Task 7: Docs and full verification

**Files:**
- Modify: `PRODUCT.md` (~line 109, statements sentence)
- Modify: `CHANGELOG.md` (`## [Unreleased]`)
- Modify: `MEMORY.md` (current "COMPLETE" entry only — the older dated entries are history)
- Modify: `docs/superpowers/specs/2026-08-11-interest-breakdown-design.md` (link this plan)

- [ ] **Step 1: PRODUCT.md**

In the statements sentence (~line 109), after "per-cycle **statements**", extend
the clause list with: interest can be split into per-APR lines (a 0% balance
transfer next to purchases) with each line's implied rate shown against its own
APR. Keep it to one sentence.

- [ ] **Step 2: CHANGELOG.md**

Under `## [Unreleased]`:

```md
### Debts: per-APR interest buckets

- A statement's interest can now be recorded as multiple APR lines — a 0%
  balance transfer next to purchases at the standard rate, cash advances, and
  so on — exactly as the issuer prints them. Each line shows the rate it
  implies against its own APR, while the statement keeps a single blended rate.
  The plain three-number close flow is unchanged when only one rate applies
```

- [ ] **Step 3: MEMORY.md**

In the topmost entry ("Sika: debt statements feature — COMPLETE
(2026-08-11)"), change "`interest_breakdown` jsonb reserved" to
"`interest_breakdown` jsonb (per-APR buckets, in use since 2026-08-12)". Leave
the older dated entries untouched — they are history.

- [ ] **Step 4: Spec link**

In `docs/superpowers/specs/2026-08-11-interest-breakdown-design.md` change
`**Implementation plan:** *(pending)*` to
`**Implementation plan:** docs/superpowers/plans/2026-08-12-interest-breakdown.md`.

- [ ] **Step 5: Full verification**

```bash
DATABASE_URL=$(grep '^DATABASE_URL' .env.local | cut -d= -f2-) npm test 2>&1 | tail -8
npx tsc --noEmit
npm run lint
```

Expected: all suites pass (including the new 6 integration tests), typecheck
clean, lint clean. `npm run build` is optional confirmation.

- [ ] **Step 6: Commit**

```bash
git add PRODUCT.md CHANGELOG.md MEMORY.md docs/superpowers/specs/2026-08-11-interest-breakdown-design.md
git commit -m "docs: per-APR interest buckets (product, changelog, memory)"
```

---

## Self-review notes

- **Spec coverage:** storage (Task 3 schema type), invariants 1–6 (Tasks 1–3),
  derivation helpers (Task 1), API write/read (Tasks 2–4), dialog UI (Task 5),
  detail UI (Task 6), analytics untouched (no task needed), docs/rollout
  (Task 7). Non-goals respected: no edit dialog, no fee split, no migration.
- **Type consistency:** `interestBreakdown` (camel, service/zod) ↔
  `interest_breakdown` (snake, API) mapping shown in Tasks 2 and 4;
  `EnrichedInterestBucket` fields (`rate`, `rateVariance`) match the
  `toStatement` mapping in Task 4; `INTEREST_BUCKET_LABELS` is defined in
  Task 1 and consumed in Tasks 5–6.
- **Sequencing:** each task commits green; Task 4 needs Task 3's row shape,
  Tasks 5–6 need Task 4's API shape.
