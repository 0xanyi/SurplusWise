# Sika — Production Go-Live Checklist (Dokploy)

This is the exact command/order checklist for single-service Dockerfile deploys.

> Confirmed: no Convex data migration is required.

---

## 0) Preconditions

- Branch is up to date (`feat/postgres-cutover` or merged equivalent).
- Dokploy Postgres service is healthy and reachable.
- Dokploy app service env vars are configured.

---

## 1) Local preflight (required)

```bash
git checkout feat/postgres-cutover
git pull origin feat/postgres-cutover
npm install
npm run lint
npx tsc --noEmit
node --import tsx --test lib/db/*.test.ts
```

---

## 2) Verify Dokploy env vars

Required:

```env
DATABASE_URL=postgresql://USER:PASSWORD@<db-host>:5432/sika
BETTER_AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Recommended safety defaults:

```env
SKIP_DB_AUTO_MIGRATE=false
SKIP_DB_SCHEMA_CHECK=false
DB_MIGRATE_RETRIES=20
DB_MIGRATE_RETRY_DELAY_MS=2000
DB_SCHEMA_CHECK_RETRIES=20
DB_SCHEMA_CHECK_RETRY_DELAY_MS=2000
```

Optional:

```env
OPENAI_API_KEY=...
S3_ENDPOINT=...
S3_BUCKET=...
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=...
```

---

## 3) Deploy in Dokploy

1. Open Dokploy → app service.
2. Confirm env vars + build arg `NEXT_PUBLIC_SITE_URL`.
3. Click **Deploy / Redeploy**.

At startup, container runs automatically:
1. `auto-migrate` (applies migrations)
2. `db-check` (verifies schema)
3. starts Next.js server

---

## 4) Watch logs (required)

In Dokploy logs, confirm these lines appear in order:

- `[db-migrate] ... Running migrations...`
- `[db-migrate] ... Migrations complete.`
- `[db-check] ... Schema verification passed.`
- `✓ Ready`

If migration/check fails, fix DB/env and redeploy.

---

## 5) Smoke test

```bash
APP_URL='https://<your-domain>'

curl -I "$APP_URL/"
curl -I "$APP_URL/api/auth/get-session"
curl -I "$APP_URL/api/analytics?period=month"
```

Manual checks:
- Sign up / sign in
- Quick add transaction
- Create budget/category
- Reports page loads
- Receipt scan works (if OpenAI + S3 configured)

---

## 6) Rollback protocol

1. In Dokploy, redeploy previous known-good image/commit.
2. If needed, restore DB from snapshot.
3. Re-run smoke tests.

---

## 7) Promote branch

```bash
git checkout main
git pull origin main
git merge --ff-only feat/postgres-cutover
git push origin main
```

(Use PR merge flow if required by your repo settings.)
