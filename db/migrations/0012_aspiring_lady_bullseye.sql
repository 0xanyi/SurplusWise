DO $$
BEGIN
  IF (SELECT count(*) FROM "users") > 1 THEN
    RAISE EXCEPTION
      'Cannot enable the one-account registration lock: users contains more than one row. Back up the database and reconcile existing accounts before upgrading.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_singleton" ON "users" USING btree ((true));
