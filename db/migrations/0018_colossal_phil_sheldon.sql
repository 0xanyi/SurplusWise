CREATE TABLE "transaction_import_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"financial_account_id" text NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payee" text;--> statement-breakpoint
ALTER TABLE "transaction_import_profiles" ADD CONSTRAINT "transaction_import_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_import_profiles" ADD CONSTRAINT "transaction_import_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_import_profiles" ADD CONSTRAINT "transaction_import_profiles_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_import_profiles_account" ON "transaction_import_profiles" USING btree ("financial_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transaction_import_profiles_account_name" ON "transaction_import_profiles" USING btree ("workspace_id","financial_account_id","name");