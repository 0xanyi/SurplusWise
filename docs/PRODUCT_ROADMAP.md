# Sika Product Roadmap

This roadmap turns Sika from a broad manual finance tracker into a ledger users
can keep accurate over time. Work is ordered by dependency: automation is not
valuable until imported money can be tied to accounts and reconciled.

## Product direction

Sika is a private, self-hosted ledger for the money a person earns, spends,
owes, invests, lends, and gives. Giving remains a first-class movement in every
phase; it is never folded into expenses for implementation convenience.

The default installation remains useful without external services. Bank sync,
AI, email, and push delivery are always optional additions to a complete manual
workflow.

## Phase 1 — Trustworthy ledger

**Status: first vertical slice implemented**

- Financial accounts scoped to a workspace
- Asset and liability account types
- Opening balances and dates
- Optional account assignment on manual entry and CSV import
- Pending, cleared, and reconciled transaction states
- Transfers kept outside income, expense, and giving reports
- Derived cleared and projected account balances
- Statement reconciliation that locks reconciled transactions
- Account filters in the transaction register
- Account balances included in net worth

Follow-up work in this phase:

- Link debt records to liability accounts so one balance cannot be counted twice
- Account register/detail view with running balances
- Bulk assignment of historical transactions
- Reconciliation history and an explicit unreconcile workflow

## Phase 2 — Reliable intake

**Status: reliable CSV intake implemented**

- Bank-shaped CSVs with debit/credit columns and signed amounts — implemented
- Stable, account-scoped import fingerprints and duplicate review — implemented
- Bank-reference mapping with a deterministic fallback when no ID is present — implemented
- Saved import profiles per financial account — implemented
- Merchant/payee as a first-class field — implemented
- OFX/QFX, QIF, and CAMT.053 import — implemented
- Needs-review inbox and metadata-only bulk actions — implemented
- Prioritized transaction rules for categorization, tags, clients, and review
  status — implemented

## Phase 3 — Giving workspace

- Giving recipients and fund/designation — implemented
- Recurring commitments and pledges — implemented
- Expected versus recorded giving by period — implemented
- Optional giving-to-income consistency view — implemented
- Multiple supporting documents per gift — implemented
- Missing-receipt review — implemented
- Annual giving summary by recipient and designation — implemented

Sika summaries are personal records, not official tax receipts issued on behalf
of a recipient.

## Phase 4 — Recurring money and notifications

- One recurring model for income, expenses, and giving — foundation implemented
- Draft generation and matching against imported transactions
- Variable expected amounts and partial settlement
- Unified financial calendar
- Self-hosted Web Push and optional SMTP delivery
- Notifications for due money, review items, budget limits, and stale backups

## Phase 5 — Planning and resilience

- Budget copy-forward, rollover, and sinking funds
- Fund-by-date targets and planned/funded/spent states
- Optional envelope budgeting
- Full JSON/ZIP export of all workspace data and receipt files
- Validated backup and restore commands
- Backup status in Settings
- Custom reports and year-over-year comparisons

## Phase 6 — Shared finances

- Workspace memberships rather than open registration
- Owner, editor, and viewer roles
- Separate identities with a shared ledger
- Assigned transaction review and audit history
- Per-member notification preferences

Isolated multi-user hosting and household sharing remain separate product
concepts. Neither will be simulated by merely removing the one-account database
constraint.

## Deliberate non-goals

- Financial advice or an AI chat layer before ledger accuracy
- Tax filing, payroll, or full business accounting
- Gamified giving streaks or judgmental reminders
- Required cloud services
- Bank sync before import review and duplicate handling are reliable
