CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_memberships_workspace_user_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
DROP INDEX "users_singleton";--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "workspace_memberships" ("workspace_id", "user_id", "role", "created_at")
SELECT "id", "user_id", 'owner', "created_at"
FROM "workspaces"
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "idx_workspace_memberships_user_workspace" ON "workspace_memberships" USING btree ("user_id","workspace_id");
