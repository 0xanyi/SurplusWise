ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;

ALTER TABLE "workspaces"
ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'GBP';

UPDATE "workspaces"
SET "currency" = 'GBP'
WHERE "currency" IS NULL OR "currency" = '';

CREATE TABLE IF NOT EXISTS "onboarding_status" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "has_completed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_onboarding_status_workspace" ON "onboarding_status" ("workspace_id");

DO $$ BEGIN
  CREATE TYPE "public"."goal_category" AS ENUM(
    'emergency_fund',
    'savings',
    'debt_payoff',
    'giving',
    'travel',
    'home',
    'education',
    'business',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "goals" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" "goal_category" NOT NULL DEFAULT 'savings',
  "target_amount" numeric(12, 2) NOT NULL,
  "current_amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "target_date" date,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_goals_user_workspace" ON "goals" ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "idx_goals_workspace_active" ON "goals" ("workspace_id", "is_active");

ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb;
