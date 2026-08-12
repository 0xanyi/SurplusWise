CREATE TABLE "giving_designations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giving_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "giving_recipient_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "giving_designation_id" text;--> statement-breakpoint
ALTER TABLE "giving_designations" ADD CONSTRAINT "giving_designations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_designations" ADD CONSTRAINT "giving_designations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_designations" ADD CONSTRAINT "giving_designations_recipient_id_giving_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."giving_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_recipients" ADD CONSTRAINT "giving_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giving_recipients" ADD CONSTRAINT "giving_recipients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_giving_designations_recipient_active" ON "giving_designations" USING btree ("recipient_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_giving_designations_recipient_name" ON "giving_designations" USING btree ("recipient_id","name");--> statement-breakpoint
CREATE INDEX "idx_giving_recipients_workspace_active" ON "giving_recipients" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_giving_recipients_workspace_name" ON "giving_recipients" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_giving_recipient_id_giving_recipients_id_fk" FOREIGN KEY ("giving_recipient_id") REFERENCES "public"."giving_recipients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_giving_designation_id_giving_designations_id_fk" FOREIGN KEY ("giving_designation_id") REFERENCES "public"."giving_designations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transactions_workspace_giving_recipient" ON "transactions" USING btree ("workspace_id","giving_recipient_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transactions_giving_attribution" CHECK (("transactions"."giving_recipient_id" is null and "transactions"."giving_designation_id" is null) or ("transactions"."type" = 'giving' and "transactions"."giving_recipient_id" is not null));