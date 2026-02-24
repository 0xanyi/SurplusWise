# SurplusWise — Production Go-Live Checklist (Dokploy)

This runbook is the **exact command order** for safe deployment.

> Confirmed: no Convex data migration is required.

---

## 0) Preconditions

- You are on branch `feat/postgres-cutover` (or the merged equivalent).
- Dokploy Postgres service is created and reachable.
- Dokploy App service is configured with env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, optional S3/OpenAI).

---

## 1) Pull latest code locally

```bash
git checkout feat/postgres-cutover
git pull origin feat/postgres-cutover
```

---

## 2) Run preflight checks

```bash
npm install
npm run lint
npx tsc --noEmit
node --import tsx --test lib/db/*.test.ts
```

All commands must pass.

---

## 3) Set production DB connection for migration command

Use the same connection string Dokploy uses for app runtime:

```bash
export DATABASE_URL='postgresql://postgres:<password>@<db-host>:5432/surpluswise'
```

Optional sanity check:

```bash
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query('select now()');console.log('db ok',r.rows[0]);await c.end();})().catch(e=>{console.error(e);process.exit(1);});"
```

---

## 4) Apply migrations (**required before deploy**)

```bash
npx drizzle-kit migrate
```

If this fails, **stop here**. Do not deploy app image.

---

## 5) Verify schema after migration

```bash
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const q=await c.query(\"select table_name from information_schema.tables where table_schema='public' and table_name in ('users','sessions','accounts','verifications','transactions','categories','budgets') order by table_name\");console.table(q.rows);const q2=await c.query(\"select column_name from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='receipt_storage_id'\");if(!q2.rowCount){throw new Error('missing transactions.receipt_storage_id')}await c.end();console.log('schema check ok');})().catch(e=>{console.error(e);process.exit(1);});"
```

---

## 6) Deploy in Dokploy

1. Open Dokploy → your app service.
2. Confirm env vars are set.
3. Click **Deploy / Redeploy**.
4. Wait for container health to turn green.

> Runtime includes DB schema verification on startup. If migrations were skipped,
> app boot will fail fast.

---

## 7) Post-deploy smoke test

```bash
APP_URL='https://<your-domain>'

curl -I "$APP_URL/"
curl -I "$APP_URL/api/auth/get-session"
curl -I "$APP_URL/api/analytics?period=month"
```

Then do manual checks in browser:
- Sign up / sign in
- Add quick transaction
- Create budget/category
- Open reports page
- Scan a receipt (if S3/OpenAI configured)

---

## 8) Rollback protocol (if needed)

1. In Dokploy, redeploy previous known-good image/commit.
2. If a migration caused issues, restore DB from backup/snapshot.
3. Re-run smoke tests.

---

## 9) Promote branch

After successful smoke test:

```bash
git checkout main
git pull origin main
git merge --ff-only feat/postgres-cutover
git push origin main
```

(Use PR merge flow if your repo requires it.)
