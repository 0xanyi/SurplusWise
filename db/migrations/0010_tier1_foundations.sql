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
