CREATE TABLE "outgoing_payment_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"outgoing_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"period_month" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outgoing_payment_logs" ADD CONSTRAINT "outgoing_payment_logs_outgoing_id_recurring_outgoings_id_fk" FOREIGN KEY ("outgoing_id") REFERENCES "public"."recurring_outgoings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_payment_logs" ADD CONSTRAINT "outgoing_payment_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_outgoing_payment_logs_user" ON "outgoing_payment_logs" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "idx_outgoing_payment_logs_outgoing" ON "outgoing_payment_logs" USING btree ("outgoing_id","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_outgoing_payment_logs_unique" ON "outgoing_payment_logs" USING btree ("outgoing_id","period_month");