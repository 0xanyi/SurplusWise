CREATE TABLE "notification_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"event_key" text NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_states_workspace_event" ON "notification_states" USING btree ("workspace_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_notification_states_user_workspace" ON "notification_states" USING btree ("user_id","workspace_id");