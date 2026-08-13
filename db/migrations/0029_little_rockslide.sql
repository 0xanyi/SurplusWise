CREATE TABLE "email_notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_notification_deliveries_subscription_event_channel";--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "destination_key" text;--> statement-breakpoint
UPDATE "notification_deliveries" SET "destination_key" = 'push:' || "subscription_id";--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "destination_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_notification_preferences" ADD CONSTRAINT "email_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notification_preferences" ADD CONSTRAINT "email_notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_notification_preferences_workspace" ON "email_notification_preferences" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_email_notification_preferences_user_workspace" ON "email_notification_preferences" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_deliveries_destination_event_channel" ON "notification_deliveries" USING btree ("destination_key","workspace_id","event_key","channel");
