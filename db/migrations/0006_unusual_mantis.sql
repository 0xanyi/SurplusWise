CREATE TYPE "public"."investment_event_type" AS ENUM('return', 'dividend', 'sale', 'partial_sale', 'loss', 'fee');--> statement-breakpoint
CREATE TYPE "public"."investment_type" AS ENUM('stock', 'crypto', 'forex', 'property', 'business', 'savings', 'other');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'partially_repaid', 'fully_repaid', 'defaulted');--> statement-breakpoint
CREATE TABLE "investment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"investment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_type" "investment_event_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"event_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"investment_type" "investment_type" NOT NULL,
	"platform" text,
	"cost_basis" numeric(14, 2) NOT NULL,
	"current_value" numeric(14, 2) NOT NULL,
	"quantity" numeric(18, 8),
	"purchase_date" date NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"repayment_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans_given" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"borrower_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"outstanding_balance" numeric(12, 2) NOT NULL,
	"loan_date" date NOT NULL,
	"expected_payback_date" date,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"interest_rate" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_given_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans_given"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans_given" ADD CONSTRAINT "loans_given_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_investment_events_investment" ON "investment_events" USING btree ("investment_id","event_date");--> statement-breakpoint
CREATE INDEX "idx_investment_events_user" ON "investment_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_investments_user" ON "investments" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_loan_repayments_loan" ON "loan_repayments" USING btree ("loan_id","repayment_date");--> statement-breakpoint
CREATE INDEX "idx_loan_repayments_user" ON "loan_repayments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_loans_given_user" ON "loans_given" USING btree ("user_id","status");