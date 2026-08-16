-- Onboarding status is per workspace, but the table was keyed on user_id alone,
-- so a second workspace's setup overwrote the first one's row instead of adding
-- its own. Widen the primary key to (user_id, workspace_id).
--
-- Safe on existing data: the old key allowed at most one row per user, so the
-- wider key cannot collide.
--
-- CONTRIBUTING.md says never to hand-edit migrations. This one is a deliberate
-- exception: drizzle-kit cannot resolve an existing primary key's name, so it
-- emitted the DROP CONSTRAINT line commented out with a `<constraint_name>`
-- placeholder and told us to fill it in. Applying the generated file unedited
-- fails with `multiple primary keys for table "onboarding_status" are not
-- allowed`. Rather than hardcode `onboarding_status_pkey`, the block below
-- looks the name up, which also makes the migration re-runnable.
DO $$
DECLARE
	pk_name text;
BEGIN
	SELECT constraint_name INTO pk_name
	FROM information_schema.table_constraints
	WHERE table_schema = 'public'
		AND table_name = 'onboarding_status'
		AND constraint_type = 'PRIMARY KEY';

	IF pk_name IS NOT NULL AND pk_name <> 'onboarding_status_user_workspace_pk' THEN
		EXECUTE format('ALTER TABLE "onboarding_status" DROP CONSTRAINT %I', pk_name);
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "onboarding_status" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "onboarding_status" ADD CONSTRAINT "onboarding_status_user_workspace_pk" PRIMARY KEY("user_id","workspace_id");
EXCEPTION WHEN invalid_table_definition THEN null;
END $$;
