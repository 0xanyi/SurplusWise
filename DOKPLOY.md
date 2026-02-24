# SurplusWise - Dokploy Deployment Guide

> For a more detailed walkthrough, see [docs/SETUP.md](docs/SETUP.md#dokploy-deployment).

## Prerequisites

1. A running Dokploy instance
2. A PostgreSQL 16+ service (use Dokploy's built-in Postgres template)
3. (Optional) MinIO or S3-compatible storage for receipt images

## Deployment Steps

### Step 1: Create Services

1. **PostgreSQL** — Dokploy → Create Service → Database → PostgreSQL.
2. **Application** — Dokploy → Create Service → Application → Docker.
   - Connect your Git repository, select branch.
   - Dockerfile path: `Dockerfile`, context: `.`

### Step 2: Set Environment Variables

**Runtime env vars** (Application → Environment):

```
DATABASE_URL=postgresql://postgres:pw@surpluswise-db:5432/surpluswise
BETTER_AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
OPENAI_API_KEY=your_openai_api_key

# S3 storage (optional)
S3_ENDPOINT=http://minio:9000
S3_BUCKET=surpluswise-receipts
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

**Build args** (Application → Build):

```
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

### Step 3: Automatic Migration on Startup (Enabled)

For single-service Dockerfile deploys, the app now runs migrations automatically
on startup before serving traffic:

1. `node auto-migrate.mjs` (with PostgreSQL advisory lock)
2. `node verify-db-schema.mjs` (schema gate)
3. `node server.js`

This means you do **not** need to run migrations locally first for normal deploys.

> Recommended: keep this enabled in production:
> - `SKIP_DB_AUTO_MIGRATE=false`
> - `SKIP_DB_SCHEMA_CHECK=false`

If your DB is inaccessible at startup, the container will fail fast and restart
until connectivity is restored.

### Step 4: Configure Domain & SSL

1. Go to **Domains** tab.
2. Add your custom domain.
3. Enable HTTPS (Let's Encrypt).
4. Container port: `3000`.

### Step 5: Deploy

Click **Deploy** and monitor build logs.

### Production Protocol Checklist

Use the exact command/order runbook here:
- [docs/PROD_GO_LIVE_CHECKLIST.md](docs/PROD_GO_LIVE_CHECKLIST.md)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Auth secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public app URL (for auth callbacks & metadata) |
| `OPENAI_API_KEY` | No | For AI-powered receipt scanning |
| `S3_ENDPOINT` | No | S3/MinIO endpoint URL |
| `S3_BUCKET` | No | Storage bucket name |
| `S3_REGION` | No | Bucket region |
| `S3_ACCESS_KEY_ID` | No | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | S3 secret key |
| `S3_PUBLIC_URL` | No | Public CDN prefix for stored files |
| `SKIP_DB_AUTO_MIGRATE` | No | Keep `false` in production (enable auto migration) |
| `DB_MIGRATE_RETRIES` | No | DB connection retries for auto-migrate (default 20) |
| `DB_MIGRATE_RETRY_DELAY_MS` | No | Delay between migrate retries in ms (default 2000) |
| `SKIP_DB_SCHEMA_CHECK` | No | Keep `false` in production (enable startup schema gate) |
| `DB_SCHEMA_CHECK_RETRIES` | No | DB readiness retries for schema check (default 20) |
| `DB_SCHEMA_CHECK_RETRY_DELAY_MS` | No | Delay between schema-check retries in ms (default 2000) |

## Troubleshooting

### Build fails
- Ensure `NEXT_PUBLIC_SITE_URL` is set in build args.

### Database connection errors
- Verify `DATABASE_URL` uses the correct internal hostname for the Postgres service.
- Ensure the database has been created.

### Authentication issues
- Verify `NEXT_PUBLIC_SITE_URL` matches your actual domain.
- Ensure `BETTER_AUTH_SECRET` is set.

### Health check failing
The app may take 30-60 seconds to start. Increase the health check `start_period` if needed.

## Updating

1. Push changes to your repository.
2. In Dokploy, click **Redeploy** (or enable auto-deploy from git).
3. Confirm logs show successful `db-migrate` and `db-check` steps.

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js Container  │────▶│  PostgreSQL   │     │  S3 / MinIO  │
│  (App + API routes) │     │  (persistent) │     │  (receipts)  │
└─────────────────────┘     └──────────────┘     └──────────────┘
```

All services run on a single Dokploy host. No external SaaS dependencies required (except OpenAI for receipt scanning).
