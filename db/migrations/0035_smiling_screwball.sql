CREATE TABLE "transaction_review_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"assigned_to_user_id" text,
	"assigned_to_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "transaction_review_events" ADD CONSTRAINT "transaction_review_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_review_events" ADD CONSTRAINT "transaction_review_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_review_events" ADD CONSTRAINT "transaction_review_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_review_events" ADD CONSTRAINT "transaction_review_events_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_review_events_transaction" ON "transaction_review_events" USING btree ("transaction_id","created_at");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transactions_workspace_assignee_review" ON "transactions" USING btree ("workspace_id","assigned_to_user_id","needs_review");