# Next DB Migration Template (Safe-by-default)

Use this template for **every future schema change**.

---

## 1) Migration metadata

- **Change ID / Date:**
- **Owner:**
- **Branch:** `feat/db-...`
- **Risk level:** Low / Medium / High
- **Backward compatible?** Yes / No

---

## 2) Problem and scope

- **Why this change is needed:**
- **Tables affected:**
- **Columns/indexes affected:**
- **API/UI impact:**
- **Data backfill required?**

---

## 3) Safe rollout strategy

Choose one:

- [ ] **Expand-only rollout** (recommended):
  - add nullable/new columns, dual-read/write if needed, then cleanup in follow-up migration
- [ ] **Breaking rollout** (requires maintenance window):
  - direct type/constraint changes with explicit downtime/rollback plan

For risky changes, split into phases:
1. Expand
2. Backfill
3. Switch reads/writes
4. Contract (drop old columns)

---

## 4) Implementation checklist

### A. Schema + SQL
- [ ] Update `db/schema.ts`
- [ ] Generate SQL: `npm run db:generate`
- [ ] Review generated SQL manually (`db/migrations/*.sql`)
- [ ] Add explicit `USING` casts for type changes where needed
- [ ] Add/adjust indexes and constraints

### B. App compatibility
- [ ] Update service-layer validation (`lib/db/validation.ts`)
- [ ] Update service logic (`lib/db/*`)
- [ ] Keep API contracts backward-compatible where possible
- [ ] Add guards for null/old values during rollout window

### C. Tests + checks
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `node --import tsx --test lib/db/*.test.ts`
- [ ] Local migrate on clean DB: `npm run db:migrate`
- [ ] Local app smoke test passes

---

## 5) Production execution protocol (Dokploy)

Single-service Dockerfile deploy uses startup:
1. `auto-migrate`
2. `db-check`
3. app boot

Pre-deploy:
- [ ] Confirm `SKIP_DB_AUTO_MIGRATE=false`
- [ ] Confirm `SKIP_DB_SCHEMA_CHECK=false`
- [ ] Ensure DB backup/snapshot exists

Deploy:
- [ ] Redeploy app
- [ ] Watch logs for:
  - `[db-migrate] ... Migrations complete.`
  - `[db-check] ... Schema verification passed.`
  - `✓ Ready`

Post-deploy:
- [ ] Run smoke test (auth, transaction create, report load)
- [ ] Monitor logs for migration-related errors for 15–30 mins

---

## 6) Rollback plan (required)

- **Code rollback:** previous image/commit in Dokploy
- **DB rollback strategy:**
  - restore snapshot OR
  - forward-fix migration if irreversible
- **Trigger condition for rollback:**
- **Owner approval required:**

---

## 7) PR checklist block

Paste into PR:

```md
### DB Migration Safety Checklist
- [ ] Schema change reviewed (`db/schema.ts` + SQL)
- [ ] Migration tested locally (`npm run db:migrate`)
- [ ] Lint/type/tests pass
- [ ] Backward compatibility assessed
- [ ] Rollback plan documented
- [ ] Dokploy startup migration log checks completed
```

---

## 8) Notes from this migration

- What went well:
- What to improve next time:
