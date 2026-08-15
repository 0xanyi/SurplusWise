DROP INDEX "idx_email_notification_preferences_workspace";--> statement-breakpoint
DROP INDEX "idx_notification_states_workspace_event";--> statement-breakpoint
DROP INDEX "idx_notification_states_user_workspace";--> statement-breakpoint
DROP INDEX "idx_push_notification_preferences_workspace";--> statement-breakpoint
DROP INDEX "idx_push_subscriptions_workspace_endpoint";--> statement-breakpoint
DROP INDEX "idx_email_notification_preferences_user_workspace";--> statement-breakpoint
DROP INDEX "idx_push_notification_preferences_user_workspace";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_states_user_workspace_event" ON "notification_states" USING btree ("user_id","workspace_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_push_subscriptions_user_workspace_endpoint" ON "push_subscriptions" USING btree ("user_id","workspace_id","endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_notification_preferences_user_workspace" ON "email_notification_preferences" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_push_notification_preferences_user_workspace" ON "push_notification_preferences" USING btree ("user_id","workspace_id");