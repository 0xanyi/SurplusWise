ALTER TABLE "users" ADD COLUMN "categories_seeded" boolean NOT NULL DEFAULT false;

-- Existing users already have category data history; prevent one-time reseed from
-- recreating defaults they may have renamed/deleted.
UPDATE "users" SET "categories_seeded" = true;
