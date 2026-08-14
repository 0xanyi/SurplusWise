CREATE TABLE "backup_status" (
	"id" text PRIMARY KEY NOT NULL,
	"last_successful_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
