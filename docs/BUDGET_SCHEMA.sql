-- ============================================================================
-- SurplusWise – Postgres Schema Reference
-- ============================================================================
-- IMPORTANT: This file is for **documentation only**.
-- The source of truth is db/schema.ts (Drizzle ORM).
-- Migrations are generated via `npm run db:generate` into db/migrations/.
-- ============================================================================

-- Enums
CREATE TYPE "transaction_type" AS ENUM ('income', 'expense', 'giving');
CREATE TYPE "budget_period"    AS ENUM ('monthly', 'quarterly', 'yearly');

-- ── Better Auth tables ──────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL UNIQUE,
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image"          TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "sessions" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "accounts" (
  "id"                       TEXT PRIMARY KEY,
  "user_id"                  TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id"               TEXT NOT NULL,
  "provider_id"              TEXT NOT NULL,
  "access_token"             TEXT,
  "refresh_token"            TEXT,
  "id_token"                 TEXT,
  "access_token_expires_at"  TIMESTAMPTZ,
  "refresh_token_expires_at" TIMESTAMPTZ,
  "scope"                    TEXT,
  "password"                 TEXT,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "verifications" (
  "id"         TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Domain tables ───────────────────────────────────────────────────────────

CREATE TABLE "transactions" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount"     NUMERIC(10,2) NOT NULL,
  "date"       DATE NOT NULL,
  "type"       "transaction_type" NOT NULL,
  "category"   TEXT NOT NULL,
  "notes"      TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "categories" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "type"       "transaction_type" NOT NULL,
  "color"      TEXT NOT NULL,
  "icon"       TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "budgets" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category"   TEXT NOT NULL,
  "amount"     NUMERIC(10,2) NOT NULL,
  "period"     "budget_period" NOT NULL DEFAULT 'monthly',
  "start_date" DATE NOT NULL,
  "end_date"   DATE NOT NULL,
  "type"       "transaction_type" NOT NULL DEFAULT 'expense',
  "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

-- Auth indexes
CREATE INDEX        "idx_accounts_user_id"             ON "accounts"     ("user_id");
CREATE INDEX        "idx_sessions_user_id"             ON "sessions"     ("user_id");
CREATE INDEX        "idx_verifications_identifier"     ON "verifications" ("identifier");

-- Domain indexes
CREATE INDEX        "idx_transactions_user_date"       ON "transactions" ("user_id", "date" DESC);
CREATE INDEX        "idx_transactions_user_type_date"  ON "transactions" ("user_id", "type", "date" DESC);
CREATE UNIQUE INDEX "idx_categories_user_type_name"    ON "categories"   ("user_id", "type", "name");
CREATE INDEX        "idx_budgets_user_active"          ON "budgets"      ("user_id", "is_active");
