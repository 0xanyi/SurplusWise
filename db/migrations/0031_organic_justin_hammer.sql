CREATE TYPE "public"."goal_activity_type" AS ENUM('contribution', 'spending');--> statement-breakpoint
CREATE TABLE "goal_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"type" "goal_activity_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"occurred_on" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_activities" ADD CONSTRAINT "goal_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_activities" ADD CONSTRAINT "goal_activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_activities" ADD CONSTRAINT "goal_activities_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_goal_activities_goal_date" ON "goal_activities" USING btree ("goal_id","occurred_on");--> statement-breakpoint
CREATE INDEX "idx_goal_activities_workspace" ON "goal_activities" USING btree ("workspace_id");