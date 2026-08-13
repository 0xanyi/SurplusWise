CREATE TYPE "public"."giving_commitment_frequency" AS ENUM('one_time', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TABLE "giving_commitments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"designation_id" text,
	"name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" "giving_commitment_frequency" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_giving_commitments_positive_amount" CHECK ("giving_commitments"."amount" > 0),
	CONSTRAINT "chk_giving_commitments_date_order" CHECK ("giving_commitments"."end_date" is null or "giving_commitments"."end_date" >= "giving_commitments"."start_date")
);
--> statement-breakpoint
ALTER TABLE "giving_commitments" ADD CONSTRAINT "giving_commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_commitments" ADD CONSTRAINT "giving_commitments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_commitments" ADD CONSTRAINT "giving_commitments_recipient_id_giving_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."giving_recipients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_commitments" ADD CONSTRAINT "giving_commitments_designation_id_giving_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."giving_designations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_giving_commitments_workspace_active" ON "giving_commitments" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_giving_commitments_recipient" ON "giving_commitments" USING btree ("recipient_id","designation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_giving_commitments_active_general_target" ON "giving_commitments" USING btree ("workspace_id","recipient_id") WHERE "giving_commitments"."is_active" and "giving_commitments"."designation_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_giving_commitments_active_designated_target" ON "giving_commitments" USING btree ("workspace_id","recipient_id","designation_id") WHERE "giving_commitments"."is_active" and "giving_commitments"."designation_id" is not null;
