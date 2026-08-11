CREATE TABLE "debt_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"statement_date" date NOT NULL,
	"due_date" date,
	"opening_balance" numeric(12, 2) NOT NULL,
	"closing_balance" numeric(12, 2) NOT NULL,
	"interest_charged" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fees_charged" numeric(10, 2) DEFAULT '0' NOT NULL,
	"new_spending" numeric(12, 2),
	"minimum_payment" numeric(10, 2),
	"balance_subject_to_interest" numeric(12, 2),
	"principal_paid" numeric(10, 2),
	"interest_paid" numeric(10, 2),
	"interest_breakdown" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_debt_statements_period" CHECK ("debt_statements"."period_end" >= "debt_statements"."period_start")
);
--> statement-breakpoint
ALTER TABLE "debts_credits" ADD COLUMN "min_payment_percent" numeric(5, 2) DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "debts_credits" ADD COLUMN "min_payment_floor" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_debts_credits_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_statements" ADD CONSTRAINT "debt_statements_debt_id_debts_credits_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_statements" ADD CONSTRAINT "debt_statements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_debt_payments_debt" ON "debt_payments" USING btree ("debt_id","paid_at");--> statement-breakpoint
CREATE INDEX "idx_debt_payments_user" ON "debt_payments" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "idx_debt_statements_debt" ON "debt_statements" USING btree ("debt_id","period_end");--> statement-breakpoint
CREATE INDEX "idx_debt_statements_user" ON "debt_statements" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_debt_statements_debt_period" ON "debt_statements" USING btree ("debt_id","period_end");--> statement-breakpoint
-- Backfill: move existing payments out of debt_balance_logs into debt_payments.
INSERT INTO "debt_payments" ("id", "debt_id", "user_id", "amount", "paid_at", "notes", "created_at")
SELECT gen_random_uuid()::text, "debt_id", "user_id", "payment_made", "logged_at", "notes", "created_at"
FROM "debt_balance_logs"
WHERE "payment_made" IS NOT NULL AND "payment_made" > 0;

-- NOTE: `debt_balance_logs.payment_made` is deliberately NOT dropped here.
-- CONTRIBUTING.md asks for destructive changes in their own flagged change, and
-- migrations run on container startup, so dropping it in the same step would
-- break a rollback to the previous image. This release stops reading and
-- writing the column (it is absent from db/schema.ts, so Drizzle never names
-- it); a follow-up migration drops it once a release has shipped on
-- debt_payments. The generated snapshot already reflects its absence, so
-- drizzle-kit will not try to drop it again.
