-- ─── Workspace type enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."workspace_type" AS ENUM('personal', 'business');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── Workspaces table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" "workspace_type" NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workspaces_user" ON "workspaces" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_workspaces_user_name" ON "workspaces" ("user_id", "name");

-- ─── Add workspace_id column to all domain tables ───────────────────────────
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "recurring_outgoings" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "debts_credits" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "loans_given" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE;

-- ─── Backfill: create a default "Personal" workspace for every existing user ─
INSERT INTO "workspaces" ("id", "user_id", "name", "type", "is_default")
SELECT
  gen_random_uuid()::text,
  u."id",
  'Personal',
  'personal',
  true
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "workspaces" w WHERE w."user_id" = u."id" AND w."is_default" = true
);

-- ─── Backfill: assign existing data to the user's default workspace ─────────
UPDATE "transactions" t
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE t."user_id" = w."user_id" AND w."is_default" = true AND t."workspace_id" IS NULL;

UPDATE "categories" c
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE c."user_id" = w."user_id" AND w."is_default" = true AND c."workspace_id" IS NULL;

UPDATE "budgets" b
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE b."user_id" = w."user_id" AND w."is_default" = true AND b."workspace_id" IS NULL;

UPDATE "recurring_outgoings" r
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE r."user_id" = w."user_id" AND w."is_default" = true AND r."workspace_id" IS NULL;

UPDATE "debts_credits" d
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE d."user_id" = w."user_id" AND w."is_default" = true AND d."workspace_id" IS NULL;

UPDATE "loans_given" l
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE l."user_id" = w."user_id" AND w."is_default" = true AND l."workspace_id" IS NULL;

UPDATE "investments" i
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE i."user_id" = w."user_id" AND w."is_default" = true AND i."workspace_id" IS NULL;

-- ─── Add workspace_id indexes for query performance ─────────────────────────
CREATE INDEX IF NOT EXISTS "idx_transactions_workspace" ON "transactions" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_categories_workspace" ON "categories" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_budgets_workspace" ON "budgets" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_recurring_outgoings_workspace" ON "recurring_outgoings" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_debts_credits_workspace" ON "debts_credits" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_loans_given_workspace" ON "loans_given" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_investments_workspace" ON "investments" ("workspace_id");
