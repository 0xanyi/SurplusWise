CREATE TYPE "public"."debt_type" AS ENUM('credit_card', 'loan', 'mortgage', 'overdraft', 'other');--> statement-breakpoint
CREATE TYPE "public"."outgoing_frequency" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TABLE "debt_balance_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"user_id" text NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"payment_made" numeric(10, 2),
	"notes" text,
	"logged_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"debt_type" "debt_type" NOT NULL,
	"lender" text,
	"current_balance" numeric(12, 2) NOT NULL,
	"credit_limit" numeric(12, 2),
	"interest_rate" numeric(5, 2),
	"minimum_payment" numeric(10, 2),
	"payment_day_of_month" integer,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_outgoings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"day_of_month" integer NOT NULL,
	"frequency" "outgoing_frequency" DEFAULT 'monthly' NOT NULL,
	"category" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debt_balance_logs" ADD CONSTRAINT "debt_balance_logs_debt_id_debts_credits_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_balance_logs" ADD CONSTRAINT "debt_balance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts_credits" ADD CONSTRAINT "debts_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_outgoings" ADD CONSTRAINT "recurring_outgoings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_debt_balance_logs_debt" ON "debt_balance_logs" USING btree ("debt_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_debt_balance_logs_user" ON "debt_balance_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_debts_credits_user" ON "debts_credits" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_recurring_outgoings_user" ON "recurring_outgoings" USING btree ("user_id","is_active");