CREATE TABLE "recurring_money_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"recurring_money_id" text NOT NULL,
	"transaction_id" text,
	"period_month" date NOT NULL,
	"due_date" date NOT NULL,
	"expected_amount" numeric(10, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category" text,
	"payee" text,
	"client_id" text,
	"giving_recipient_id" text,
	"giving_designation_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_recurring_money_drafts_period_month_day" CHECK (EXTRACT(DAY FROM "recurring_money_drafts"."period_month") = 1),
	CONSTRAINT "chk_recurring_money_drafts_positive_amount" CHECK ("recurring_money_drafts"."expected_amount" > 0),
	CONSTRAINT "chk_recurring_money_drafts_giving_attribution" CHECK (("recurring_money_drafts"."giving_recipient_id" IS NULL AND "recurring_money_drafts"."giving_designation_id" IS NULL) OR ("recurring_money_drafts"."type" = 'giving' AND "recurring_money_drafts"."giving_recipient_id" IS NOT NULL)),
	CONSTRAINT "chk_recurring_money_drafts_client_type" CHECK ("recurring_money_drafts"."type" = 'expense' OR "recurring_money_drafts"."client_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_recurring_money_id_recurring_outgoings_id_fk" FOREIGN KEY ("recurring_money_id") REFERENCES "public"."recurring_outgoings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_giving_recipient_id_giving_recipients_id_fk" FOREIGN KEY ("giving_recipient_id") REFERENCES "public"."giving_recipients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_money_drafts" ADD CONSTRAINT "recurring_money_drafts_giving_designation_id_giving_designations_id_fk" FOREIGN KEY ("giving_designation_id") REFERENCES "public"."giving_designations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_recurring_money_drafts_period" ON "recurring_money_drafts" USING btree ("recurring_money_id","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_recurring_money_drafts_transaction" ON "recurring_money_drafts" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_money_drafts_workspace_due" ON "recurring_money_drafts" USING btree ("workspace_id","period_month","due_date");