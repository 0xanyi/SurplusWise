# Sika Setup Guide

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Provision a PostgreSQL Database

Use any Postgres 16+ instance — local, Neon, Supabase, or Docker:

```bash
# Docker one-liner for local dev
docker run -d --name sika-db \
  -e POSTGRES_USER=sika \
  -e POSTGRES_PASSWORD=localdev \
  -e POSTGRES_DB=sika \
  -p 5432:5432 postgres:16-alpine
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://sika:localdev@localhost:5432/sika
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key

# S3-compatible storage (optional — required for receipt image uploads)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=sika-receipts
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Dokploy Deployment

Sika is designed for self-hosted deployment via [Dokploy](https://dokploy.com).

### Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js Container  │────▶│  PostgreSQL   │     │  S3 / MinIO  │
│  (App + API routes) │     │  (persistent) │     │  (receipts)  │
└─────────────────────┘     └──────────────┘     └──────────────┘
```

All components run on a single Dokploy server. No external SaaS dependencies required (except OpenAI for receipt scanning).

### Step 1: Create Services in Dokploy

1. **PostgreSQL service** — use Dokploy's built-in Postgres template.
   - Set `POSTGRES_DB=sika`
   - Note the internal connection string (e.g., `postgresql://postgres:pw@sika-db:5432/sika`).

2. **(Optional) MinIO service** — for receipt image storage.
   - Create a bucket named `sika-receipts`.

3. **Application service** — Docker build from your Git repo.
   - Set Dockerfile path: `Dockerfile`
   - Container port: `3000`

### Step 2: Set Environment Variables

In the application service → Environment:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your public app URL |
| `OPENAI_API_KEY` | No | For AI receipt scanning |
| `S3_ENDPOINT` | No | S3/MinIO endpoint |
| `S3_BUCKET` | No | Bucket name |
| `S3_REGION` | No | Bucket region |
| `S3_ACCESS_KEY_ID` | No | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | S3 secret key |
| `S3_PUBLIC_URL` | No | Public CDN/URL prefix |
| `SKIP_DB_AUTO_MIGRATE` | No | Keep `false` in production (enable auto migration) |
| `DB_MIGRATE_RETRIES` | No | DB connection retries for auto-migrate (default 20) |
| `DB_MIGRATE_RETRY_DELAY_MS` | No | Delay between migrate retries in ms (default 2000) |
| `SKIP_DB_SCHEMA_CHECK` | No | Keep `false` in production (enable startup schema gate) |
| `DB_SCHEMA_CHECK_RETRIES` | No | DB readiness retries for schema check (default 20) |
| `DB_SCHEMA_CHECK_RETRY_DELAY_MS` | No | Delay between retries in ms (default 2000) |

**Build args** (set in Build section):

| Arg | Description |
|-----|-------------|
| `NEXT_PUBLIC_SITE_URL` | Same as runtime — needed at build time for metadata |

### Step 3: Automatic Migration + Schema Gate (Enabled)

For single-service Dockerfile deploys, the container now performs startup steps
in this order:

1. `node auto-migrate.mjs` (applies pending Drizzle migrations)
2. `node verify-db-schema.mjs` (ensures required tables/columns exist)
3. `node server.js` (starts app)

So you do **not** need to run migrations manually before each deploy.

Recommended production settings:

```env
SKIP_DB_AUTO_MIGRATE=false
SKIP_DB_SCHEMA_CHECK=false
```

If DB connectivity is unavailable, startup fails fast and container restarts
until the database is reachable.

### Step 4: Deploy

Click **Deploy** in Dokploy. Monitor build logs. Once complete, access via your configured domain.

### Step 5: Domain & SSL

1. Go to **Domains** tab in Dokploy.
2. Add your custom domain.
3. Enable HTTPS (Let's Encrypt auto-provisions).
4. Container port: `3000`.

### Production Runbook

For exact production command order, use:
- [docs/PROD_GO_LIVE_CHECKLIST.md](./PROD_GO_LIVE_CHECKLIST.md)

---

## Testing the Setup

1. Sign up and log in.
2. Add a transaction and confirm it appears in the dashboard.
3. Upload a receipt and verify AI scanning works.
4. Check the analytics dashboard and export CSV/PDF reports.

## Troubleshooting

### Database connection errors
- Verify `DATABASE_URL` is correct and the Postgres service is running.
- Ensure the database exists (`CREATE DATABASE sika;`).

### Auth errors
- Ensure `NEXT_PUBLIC_SITE_URL` matches your actual domain (including protocol).
- Regenerate `BETTER_AUTH_SECRET` if sessions fail to validate.

### Receipt upload fails
- Verify S3 credentials and bucket exist.
- Check that the bucket policy allows PutObject.

### Build fails
- Ensure `next.config.js` has `output: "standalone"`.
- Check that all build-time `NEXT_PUBLIC_*` vars are set.

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:studio    # Open Drizzle Studio
```
