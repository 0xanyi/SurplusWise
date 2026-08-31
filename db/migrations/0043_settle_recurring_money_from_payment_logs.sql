-- Additive. A month is settled only by matching Transactions.
--
-- Each outgoing payment log becomes a Transaction matched to that month's
-- Recurring money draft, unless the draft already has a matched Transaction
-- (the double-count case). The application no longer reads or writes
-- `outgoing_payment_logs`; the table is left populated so a rollback to the
-- previous image still finds its data. Drop it in a later migration after a
-- release carrying 0043 has shipped.

INSERT INTO "recurring_money_drafts" (
  "id",
  "user_id",
  "workspace_id",
  "recurring_money_id",
  "period_month",
  "due_date",
  "expected_amount",
  "type",
  "category",
  "payee",
  "client_id",
  "giving_recipient_id",
  "giving_designation_id",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  ro."user_id",
  ro."workspace_id",
  ro."id",
  log."period_month",
  make_date(
    EXTRACT(YEAR FROM log."period_month")::int,
    EXTRACT(MONTH FROM log."period_month")::int,
    LEAST(
      ro."day_of_month",
      EXTRACT(DAY FROM (date_trunc('month', log."period_month") + interval '1 month - 1 day'))::int
    )
  ),
  ro."amount",
  ro."type",
  ro."category",
  ro."vendor",
  ro."client_id",
  ro."giving_recipient_id",
  ro."giving_designation_id",
  ro."notes",
  COALESCE(log."created_at", now()),
  COALESCE(log."created_at", now())
FROM "outgoing_payment_logs" log
INNER JOIN "recurring_outgoings" ro ON ro."id" = log."outgoing_id"
ON CONFLICT ("recurring_money_id", "period_month") DO NOTHING;
--> statement-breakpoint

WITH settled AS (
  SELECT DISTINCT s."draft_id"
  FROM "recurring_money_draft_settlements" s
),
to_insert AS (
  SELECT
    gen_random_uuid()::text AS transaction_id,
    gen_random_uuid()::text AS settlement_id,
    d."id" AS draft_id,
    d."user_id",
    d."workspace_id",
    log."amount",
    log."paid_at",
    d."type",
    COALESCE(d."category", 'Uncategorized') AS category,
    d."payee",
    d."client_id",
    d."giving_recipient_id",
    d."giving_designation_id",
    log."notes",
    log."created_at"
  FROM "outgoing_payment_logs" log
  INNER JOIN "recurring_money_drafts" d
    ON d."recurring_money_id" = log."outgoing_id"
    AND d."period_month" = log."period_month"
  WHERE d."id" NOT IN (SELECT "draft_id" FROM settled)
)
, ins_tx AS (
  INSERT INTO "transactions" (
    "id",
    "user_id",
    "workspace_id",
    "amount",
    "date",
    "type",
    "status",
    "needs_review",
    "category",
    "payee",
    "client_id",
    "giving_recipient_id",
    "giving_designation_id",
    "notes",
    "tags",
    "created_at",
    "updated_at"
  )
  SELECT
    transaction_id,
    user_id,
    workspace_id,
    amount,
    paid_at,
    type,
    'cleared',
    false,
    category,
    payee,
    client_id,
    giving_recipient_id,
    giving_designation_id,
    notes,
    '["recurring-settlement"]'::jsonb,
    COALESCE(created_at, now()),
    COALESCE(created_at, now())
  FROM to_insert
  RETURNING "id"
)
INSERT INTO "recurring_money_draft_settlements" (
  "id",
  "user_id",
  "workspace_id",
  "draft_id",
  "transaction_id",
  "created_at"
)
SELECT
  settlement_id,
  user_id,
  workspace_id,
  draft_id,
  transaction_id,
  COALESCE(created_at, now())
FROM to_insert;
