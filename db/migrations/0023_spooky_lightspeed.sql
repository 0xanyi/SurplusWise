CREATE TABLE "transaction_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_transaction_documents_positive_size" CHECK ("transaction_documents"."size_bytes" is null or "transaction_documents"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_documents_workspace_transaction" ON "transaction_documents" USING btree ("workspace_id","transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transaction_documents_transaction_storage" ON "transaction_documents" USING btree ("transaction_id","storage_key");--> statement-breakpoint
INSERT INTO "transaction_documents" (
	"id", "user_id", "workspace_id", "transaction_id", "storage_key", "file_name", "created_at"
)
SELECT
	'legacy-' || "id", "user_id", "workspace_id", "id", "receipt_storage_id", 'Receipt', "created_at"
FROM "transactions"
WHERE "type" = 'giving' AND "workspace_id" IS NOT NULL AND "receipt_storage_id" IS NOT NULL
ON CONFLICT DO NOTHING;
