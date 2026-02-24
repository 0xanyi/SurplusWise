# Postgres Cutover Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Replace Convex with self-hosted PostgreSQL (on Dokploy) before further feature work, while preserving current product behavior (income/expense/giving, budgets, reports, receipt scan, auth).

**Architecture:** Perform a **big-bang cutover** (not incremental dual-write) because there is no production user data yet. Keep existing route surface (`/api/...`) and move all reads/writes behind Next.js route handlers + Postgres access layer. Keep Better Auth, but switch from Convex plugin to Postgres adapter.

**Tech Stack:** Next.js App Router, PostgreSQL 16+, Drizzle ORM + drizzle-kit, Better Auth (SQL adapter), S3-compatible object storage (MinIO/R2/S3), OpenAI Vision.

---

## Scope + Migration Strategy

- **Recommended approach:** full replacement now (no compatibility bridge) since app is not in active use.
- **Out of scope for this cutover:** adding new end-user features.
- **Success criteria:**
  1. App runs with no Convex dependency.
  2. Auth, transactions, categories, budgets, analytics, receipts all work.
  3. Lint + typecheck pass.
  4. Dokploy deploy is reproducible with Postgres + app containers.

---

### Task 1: Branch, baseline snapshot, and dependency setup

**TDD scenario:** Trivial infra change — baseline verification first.

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example` (create if missing)

**Step 1: Create dedicated migration branch**
- Run: `git checkout -b feat/postgres-cutover`

**Step 2: Capture baseline behavior (manual smoke checklist)**
- Login/signup
- Quick add transaction
- Budget create/edit
- Reports page load
- Receipt scan request

**Step 3: Add DB dependencies (minimal set)**
- Add: `drizzle-orm`, `pg`, `drizzle-kit`
- (Optional) add `tsx` for migration scripts.

**Step 4: Add scripts**
- `db:generate`, `db:migrate`, `db:studio`

**Step 5: Commit**
```bash
git add package.json README.md .env.example
git commit -m "chore: prepare postgres cutover toolchain"
```

---

### Task 2: Build Postgres schema + migrations

**TDD scenario:** New feature — schema-first then DB validation.

**Files:**
- Create: `drizzle.config.ts`
- Create: `db/schema.ts`
- Create: `db/client.ts`
- Create: `db/migrations/*`
- Modify: `docs/BUDGET_SCHEMA.sql` (or replace with Drizzle-first doc note)

**Step 1: Define canonical schema tables**
- `users`, `sessions`, `accounts`, `verification_tokens` (Better Auth expected)
- `transactions`
- `categories`
- `budgets`
- `receipt_files` (if storing metadata separate from transactions)

**Step 2: Preserve current business enums**
- Transaction/Budget type: `income | expense | giving`
- Budget period: `monthly | quarterly | yearly`

**Step 3: Add indexes mirroring current query patterns**
- `transactions(user_id, date desc)`
- `transactions(user_id, type, date desc)`
- `categories(user_id, type, name)` unique
- `budgets(user_id, is_active)`

**Step 4: Generate and run migration locally**
- Run: `npm run db:generate`
- Run: `npm run db:migrate`
- Validate via psql/Drizzle Studio.

**Step 5: Commit**
```bash
git add drizzle.config.ts db/schema.ts db/client.ts db/migrations docs/BUDGET_SCHEMA.sql
git commit -m "feat: add postgres schema and migrations"
```

---

### Task 3: Migrate Better Auth from Convex adapter to Postgres adapter

**TDD scenario:** Modifying tested login flow — verify auth flow before and after each change.

**Files:**
- Modify: `lib/auth-server.ts`
- Modify: `lib/auth-client.ts`
- Modify: `app/api/auth/[...all]/route.ts`
- Create: `lib/auth.ts` (server auth config)
- Remove/stop using: `convex/auth.ts`, `convex/auth.config.ts`

**Step 1: Implement Better Auth server config using Postgres/Drizzle adapter**
- Keep current email/password policy.

**Step 2: Update server helper exports**
- Replace Convex helper surface (`fetchAuthQuery`, `fetchAuthMutation`, etc.) with native session helpers.

**Step 3: Update client auth hook wiring**
- Keep `useSession`, `signIn`, `signOut`, `signUp` API shape if possible to minimize UI churn.

**Step 4: Manual auth verification**
- Signup → login → session persistence → logout.

**Step 5: Commit**
```bash
git add lib/auth-server.ts lib/auth-client.ts lib/auth.ts app/api/auth/[...all]/route.ts convex/auth.ts convex/auth.config.ts
git commit -m "feat: switch better-auth to postgres adapter"
```

---

### Task 4: Add DB service layer for core domain operations

**TDD scenario:** New feature — build query modules with deterministic return types.

**Files:**
- Create: `lib/db/transactions.ts`
- Create: `lib/db/categories.ts`
- Create: `lib/db/budgets.ts`
- Create: `lib/db/analytics.ts`
- Create: `lib/db/default-categories.ts`

**Step 1: Port Convex business logic to SQL service functions**
- Transactions list/listRecent/listPaginated/create/update/delete
- Categories list/create/update/delete/ensureDefaults
- Budgets create/update/delete/getWithSpending
- Analytics aggregations

**Step 2: Add runtime validation for route inputs (zod)**
- Guarantee API contracts remain stable.

**Step 3: Unit-test pure logic helpers where practical**
- Date range generation
- Budget status math
- category defaulting idempotency

**Step 4: Commit**
```bash
git add lib/db/transactions.ts lib/db/categories.ts lib/db/budgets.ts lib/db/analytics.ts lib/db/default-categories.ts
git commit -m "feat: add postgres-backed finance service layer"
```

---

### Task 5: Replace API routes with Postgres-backed handlers

**TDD scenario:** Modifying existing behavior — endpoint parity checks first.

**Files:**
- Modify: `app/api/categories/route.ts`
- Modify: `app/api/categories/[id]/route.ts`
- Modify: `app/api/budgets/route.ts`
- Modify: `app/api/budgets/[id]/route.ts`
- Modify: `app/api/analytics/route.ts`
- Create: `app/api/transactions/route.ts`
- Create: `app/api/transactions/[id]/route.ts`

**Step 1: Keep existing URL contracts stable**
- Avoid frontend breakage.

**Step 2: Replace Convex calls with `lib/db/*` calls**
- All auth checks based on Better Auth session user id.

**Step 3: Add route-level pagination defaults and guards**
- Prevent expensive queries.

**Step 4: Endpoint smoke validation**
- GET/POST/PATCH/DELETE for categories/budgets/transactions
- GET analytics period filters.

**Step 5: Commit**
```bash
git add app/api/categories app/api/budgets app/api/analytics app/api/transactions
 git commit -m "feat: migrate finance api routes to postgres"
```

---

### Task 6: Migrate frontend data access from Convex hooks to API fetch hooks

**TDD scenario:** Modifying tested UI behavior — preserve interaction flows.

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/quick-add-transaction.tsx`
- Modify: `components/dashboard/transaction-form.tsx`
- Modify: `components/dashboard/transaction-list.tsx`
- Modify: `components/dashboard/budget-overview.tsx`
- Modify: `components/dashboard/budget-management.tsx`
- Modify: `components/dashboard/category-management.tsx`
- Create: `hooks/use-api-query.ts` (optional)
- Create: `hooks/use-api-mutation.ts` (optional)

**Step 1: Remove `convex/react` usage from components**
- Replace with fetch + local state cache invalidation.

**Step 2: Keep UX behavior unchanged**
- Quick add
- scan/manual form modes
- transaction pagination
- budget/category CRUD.

**Step 3: Ensure `ensureDefaults` runs after login (via API endpoint/service)**

**Step 4: Commit**
```bash
git add app/dashboard components/dashboard hooks
 git commit -m "refactor: replace convex hooks with api-based data layer"
```

---

### Task 7: Receipt storage cutover (Convex storage -> S3-compatible)

**TDD scenario:** Modifying external integration — fail fast with explicit errors.

**Files:**
- Modify: `app/api/receipts/scan/route.ts`
- Create: `lib/storage.ts`
- Create: `app/api/receipts/[id]/route.ts` (optional signed-url proxy)
- Modify: `components/dashboard/receipt-scanner.tsx` (if response shape changes)

**Step 1: Keep OCR extraction logic (OpenAI) but change file storage backend**
- Upload binary to S3-compatible bucket.

**Step 2: Persist receipt metadata in Postgres**
- Link stored file key/url to transaction.

**Step 3: Validate upload limits + mime checks**
- Maintain 5MB image guard.

**Step 4: Commit**
```bash
git add app/api/receipts lib/storage.ts components/dashboard/receipt-scanner.tsx
 git commit -m "feat: migrate receipt storage to s3-compatible backend"
```

---

### Task 8: Remove Convex, finalize deployment, and verify cutover

**TDD scenario:** Regression verification and cleanup.

**Files:**
- Remove: `convex/**` (except archival docs if desired)
- Remove: `components/providers/convex-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `package.json`
- Modify: `README.md`, `docs/SETUP.md`, `docs/MIGRATION_GUIDE.md`
- Modify: Dokploy env/config docs

**Step 1: Remove Convex scripts/dependencies/env usage**
- Delete `dev:backend`, `convex deploy` build path.

**Step 2: Standardize scripts for pure Next.js + Postgres**
- `dev`, `build`, `start`, `db:*`.

**Step 3: Full verification**
- Run: `npm run lint`
- Run: `npx tsc --noEmit`
- Run: manual smoke flow end-to-end.

**Step 4: Production dry run in Dokploy staging**
- New DB provision + migration + app deploy.

**Step 5: Commit + merge**
```bash
git add -A
git commit -m "chore: complete convex to postgres cutover"
```

---

## Rollout Notes (Dokploy)

1. Provision Postgres service + persistent volume.
2. Add env vars:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `SITE_URL`
   - `OPENAI_API_KEY`
   - S3 vars (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`)
3. Run migrations as release step before app starts.
4. Deploy app container.

---

## Final Acceptance Checklist

- [ ] No imports from `convex/*` or `@convex-dev/*` remain.
- [ ] Auth works entirely via Postgres-backed Better Auth.
- [ ] Transactions/categories/budgets/analytics function correctly.
- [ ] Receipt scan + image persistence works.
- [ ] Lint + typecheck pass.
- [ ] README/SETUP updated for Dokploy + Postgres.
