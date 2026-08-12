CREATE TABLE "transaction_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"match_field" text NOT NULL,
	"match_value" text NOT NULL,
	"transaction_type" "transaction_type",
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" text,
	"mark_reviewed" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_transaction_rules_match_field" CHECK ("transaction_rules"."match_field" in ('payee', 'notes')),
	CONSTRAINT "chk_transaction_rules_has_action" CHECK ("transaction_rules"."is_active" = false or "transaction_rules"."category" is not null or "transaction_rules"."client_id" is not null or jsonb_array_length("transaction_rules"."tags") > 0 or "transaction_rules"."mark_reviewed" = true)
);
--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_rules_workspace_active_priority" ON "transaction_rules" USING btree ("workspace_id","is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transaction_rules_workspace_name" ON "transaction_rules" USING btree ("workspace_id","name");
