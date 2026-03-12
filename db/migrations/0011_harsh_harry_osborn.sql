-- Migration: Add AI provider settings, goals, onboarding_status tables
-- Uses DO blocks for idempotency where drizzle-kit doesn't support IF NOT EXISTS

DO $$
BEGIN
    -- Create goal_category type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'goal_category' AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE "public"."goal_category" AS ENUM('emergency_fund', 'savings', 'debt_payoff', 'giving', 'travel', 'home', 'education', 'business', 'other');
    END IF;
END $$;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_provider_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"api_endpoint" text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	"api_key" text,
	"model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"category" "goal_category" DEFAULT 'savings' NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "onboarding_status" (
	"user_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"has_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

DO $$
BEGIN
    -- Add tags column to transactions if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'tags'
    ) THEN
        ALTER TABLE "transactions" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    -- Add onboarding_completed column to users if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    -- Add currency column to workspaces if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workspaces' AND column_name = 'currency'
    ) THEN
        ALTER TABLE "workspaces" ADD COLUMN "currency" text DEFAULT 'GBP' NOT NULL;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ai_provider_settings_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "ai_provider_settings" ADD CONSTRAINT "ai_provider_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'goals_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'goals_workspace_id_workspaces_id_fk'
    ) THEN
        ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'onboarding_status_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "onboarding_status" ADD CONSTRAINT "onboarding_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'onboarding_status_workspace_id_workspaces_id_fk'
    ) THEN
        ALTER TABLE "onboarding_status" ADD CONSTRAINT "onboarding_status_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_ai_provider_settings_user" ON "ai_provider_settings" USING btree ("user_id");

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_provider_settings_user_unique" ON "ai_provider_settings" USING btree ("user_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_goals_user_workspace" ON "goals" USING btree ("user_id","workspace_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_goals_workspace_active" ON "goals" USING btree ("workspace_id","is_active");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_onboarding_status_workspace" ON "onboarding_status" USING btree ("workspace_id");