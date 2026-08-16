DROP INDEX "idx_categories_user_type_name";--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "categories_seeded" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Defensive repeat of the 0009 backfill. categories.workspace_id is still
-- nullable, and NULLs count as distinct in a unique index, so any row that
-- somehow escaped 0009 would sit outside the new key.
UPDATE "categories" c
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE c."user_id" = w."user_id" AND w."is_default" = true AND c."workspace_id" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "idx_categories_workspace_type_name" ON "categories" USING btree ("user_id","workspace_id","type","name");--> statement-breakpoint

-- Carry the old per-user marker over to the workspaces that earned it, so
-- renamed or deleted defaults are not resurrected on the next app load. A
-- workspace counts as already seeded when it holds categories, or when it is
-- the default workspace of a user who was marked seeded — under the old model
-- that is the only workspace the single seed could have gone to, and the user
-- may since have deleted every category in it.
--
-- Everything else keeps the false default, which is the point of this change:
-- workspaces that never got categories are seeded on next load.
UPDATE "workspaces" w
SET "categories_seeded" = true
WHERE EXISTS (SELECT 1 FROM "categories" c WHERE c."workspace_id" = w."id")
   OR (
     w."is_default"
     AND EXISTS (
       SELECT 1 FROM "users" u
       WHERE u."id" = w."user_id" AND u."categories_seeded" = true
     )
   );
