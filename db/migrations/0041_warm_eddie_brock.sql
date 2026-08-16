-- Every table that 0009 backfilled kept a nullable workspace_id, which leaves
-- the workspace scoping unenforced at the database level. Tighten all seven.
--
-- These columns are the only place a row can escape its workspace, so a stray
-- NULL is invisible to every workspace-scoped query. Nothing writes NULL today
-- (each service validates workspaceId before inserting), so this is a cleanup
-- of the 0009 leftovers rather than a behaviour change.
--
-- Hand-extended: drizzle-kit emits only the seven ALTERs. Applied on their own
-- they abort on the first pre-existing NULL, and because the app container
-- gates startup on migrations completing, that turns a stale row into a failure
-- to boot. The block below adopts those rows first and, if any genuinely cannot
-- be placed, fails with an actionable message instead of a bare NOT NULL error.
DO $$
DECLARE
	scoped_table text;
	orphans bigint;
	report text := '';
BEGIN
	FOREACH scoped_table IN ARRAY ARRAY[
		'transactions',
		'categories',
		'budgets',
		'recurring_outgoings',
		'debts_credits',
		'loans_given',
		'investments'
	] LOOP
		-- Repeat of the 0009 backfill, preferring the user's default workspace
		-- and otherwise their oldest, so the choice is deterministic.
		EXECUTE format($f$
			UPDATE %I r
			SET "workspace_id" = (
				SELECT w."id"
				FROM "workspaces" w
				WHERE w."user_id" = r."user_id"
				ORDER BY w."is_default" DESC, w."created_at" ASC
				LIMIT 1
			)
			WHERE r."workspace_id" IS NULL
				AND EXISTS (SELECT 1 FROM "workspaces" w WHERE w."user_id" = r."user_id")
		$f$, scoped_table);

		EXECUTE format('SELECT count(*) FROM %I WHERE "workspace_id" IS NULL', scoped_table)
			INTO orphans;

		IF orphans > 0 THEN
			report := report || format('%s (%s rows), ', scoped_table, orphans);
		END IF;
	END LOOP;

	IF report <> '' THEN
		RAISE EXCEPTION
			'Cannot make workspace_id NOT NULL. Rows still unassigned: %. These belong to a user with no workspace at all, so there is nowhere to put them. Back up the database, create a workspace for those users (or remove the rows), then restart to re-run this migration.',
			rtrim(report, ', ');
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debts_credits" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loans_given" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "workspace_id" SET NOT NULL;
