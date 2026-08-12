CREATE TYPE "public"."rebill_mode" AS ENUM('none', 'at_cost', 'fixed', 'bundled');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD COLUMN "vendor" text;--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD COLUMN "rebill_mode" "rebill_mode" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD COLUMN "rebill_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_workspace_active" ON "clients" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clients_workspace_name" ON "clients" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD CONSTRAINT "recurring_outgoings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recurring_outgoings_client" ON "recurring_outgoings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_workspace_client" ON "transactions" USING btree ("workspace_id","client_id");--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD CONSTRAINT "chk_recurring_outgoings_rebill_client" CHECK ("recurring_outgoings"."rebill_mode" = 'none' OR "recurring_outgoings"."client_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD CONSTRAINT "chk_recurring_outgoings_rebill_amount" CHECK ("recurring_outgoings"."rebill_mode" <> 'fixed' OR "recurring_outgoings"."rebill_amount" IS NOT NULL);