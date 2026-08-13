CREATE TABLE "recurring_money_draft_settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" DROP CONSTRAINT "recurring_money_drafts_transaction_id_transactions_id_fk";
--> statement-breakpoint
DROP INDEX "idx_recurring_money_drafts_transaction";--> statement-breakpoint
ALTER TABLE "recurring_money_draft_settlements" ADD CONSTRAINT "recurring_money_draft_settlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_draft_settlements" ADD CONSTRAINT "recurring_money_draft_settlements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_draft_settlements" ADD CONSTRAINT "recurring_money_draft_settlements_draft_id_recurring_money_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."recurring_money_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_draft_settlements" ADD CONSTRAINT "recurring_money_draft_settlements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recurring_money_draft_settlements_draft" ON "recurring_money_draft_settlements" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_recurring_money_draft_settlements_transaction" ON "recurring_money_draft_settlements" USING btree ("transaction_id");--> statement-breakpoint
INSERT INTO "recurring_money_draft_settlements" (
	"id",
	"user_id",
	"workspace_id",
	"draft_id",
	"transaction_id",
	"created_at"
)
SELECT
	gen_random_uuid()::text,
	"user_id",
	"workspace_id",
	"id",
	"transaction_id",
	"updated_at"
FROM "recurring_money_drafts"
WHERE "transaction_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" DROP COLUMN "transaction_id";
