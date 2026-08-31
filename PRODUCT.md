# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** an individual managing their own money who also gives regularly — tithes,
partnership, offerings, donations — and wants that giving tracked as deliberately as
their spending. They are motivated by stewardship, not by optimization: the question
they bring is "am I being consistent?" more than "am I being efficient?"

**Also served, without a separate product:** anyone tracking personal money. Giving is
never mandatory. A user who never records a giving transaction gets a complete,
coherent expense-and-income tracker with nothing nagging them about an unused pillar.

**Second workspace, same person:** sole traders, freelancers, and small-business owners
who need business money kept genuinely separate from personal money rather than tagged
inside one ledger.

**Operator:** the person who self-hosts the instance. Often the same person as the
primary user; sometimes a technical family member or church administrator hosting for
someone else. They care about the data never leaving their server.

*(Decided during init at the user's request: "everyone, but targeted at faith-motivated
individuals as well" — resolved as faith-motivated primary, general-purpose by
construction. Correct this if the emphasis is wrong.)*

## Product Purpose

Sika is a self-hosted personal and business finance manager. It records income,
expenses, and giving; tracks recurring outgoings, debts, money lent to others,
investments, budgets, and goals; and reports on all of it by period and category,
with optional AI receipt scanning for capture.

*Sika* is Twi for "money".

Success is a user who still has accurate numbers in it three months later, because
entry was fast enough that they never fell behind, and because the record includes
the giving that other trackers make them approximate.

## Positioning

**Giving is a third kind of money movement, not a category of spending.** In the data
model it is a peer of income and expense (`transaction_type` enum: `income | expense |
giving`), with its own default categories, its own budgets, and its own line in every
report and export. Trackers that treat tithes as an expense tag can produce a total;
they cannot answer "what did I give this year, separate from what I spent" without the
user maintaining the separation by hand.

**Reinforcing, not the headline:**

- Fully self-hosted, with **zero required third-party services**. Receipt scanning and
  S3 storage are off until configured, so a default install sends nothing anywhere.
  When AI is enabled it can point at any OpenAI-compatible endpoint including a local
  Ollama — the user chooses whether their receipts ever leave the building.
- Workspaces isolate personal from business at the data layer, not by convention. Every
  feature is workspace-scoped.

*(Decided during init at the user's request. The claim is structural and defensible
today; it is a position, not a measured market finding.)*

## Operating Context

- Entry happens in small moments — after a purchase, after a service, at the end of a
  week — often one-handed on a phone. The app is a PWA and mobile-first responsive;
  desktop is where review, reporting, and setup happen.
- Giving is frequently cash or bank transfer with no receipt, entered from memory, and
  often on a rhythm (weekly service, monthly partnership) rather than ad hoc.
- Users switch workspaces mid-session; the active workspace is a persistent, visible
  piece of state, and being wrong about which one is active corrupts the record.
- Reporting has real deadlines behind it: tax year, financial year-end, annual giving
  summaries. CSV export exists so the numbers can leave the app.
- The instance bootstraps with one operator account via `SIKA_SETUP_TOKEN`. That
  account may own many personal and business workspaces, and may invite other
  people onto a workspace as members (household sharing). Isolated multi-user
  (several private accounts on one server, each with their own unshared books)
  is still not the same thing and is not offered as a separate product mode.
- Security posture (shipped in v1.0.0): public self-registration is not open. An
  empty instance is claimed once via a server-side setup token
  (`SIKA_SETUP_TOKEN`); after the first account exists, signup is closed at the
  auth API, not only in the UI, and a database constraint enforces the single
  account. There is no admin tier — the first account is an ordinary user; the
  setup token is bootstrap authority, not a product role.
- Deployment is Docker Compose or Dokploy on the user's own server; migrations run at
  startup.

## Capabilities and Constraints

**Present:**

- Email/password auth (Better Auth); no admin tier — the first account is an
  ordinary user. Creating it requires the operator's server-only
  `SIKA_SETUP_TOKEN`. Further people join a workspace by invitation, as members.
- Workspaces: `personal` and `business` types, multiple allowed, per-workspace
  currency. Isolation of the books is the workspace, not the owner. Members act
  as themselves on those books.
- Transactions: `income`, `expense`, `giving`; CRUD, search, type/category/date-range
  filtering at the database level. Transactions can optionally belong to a
  financial account and carry pending, cleared, or reconciled status.
- Financial accounts: asset and liability accounts, opening and derived balances,
  linked transfers that never enter income/expense/giving reports, statement
  reconciliation, and account balances included in net worth. Historical
  transactions remain explicitly unassigned until the user places them.
- Categories: 10 default expense, 8 default giving, plus custom, color-coded,
  per workspace.
- Budgets: monthly / quarterly / yearly, per expense and giving category, with
  live spent-vs-allocated progress.
- Projected income: the same periods for income categories, compared with
  recorded income so a month has an expected total before it is received.
  Workspace-scoped, so personal and business projections stay separate.
- Recurring outgoings with payment logs; investments (stock, crypto, forex,
  property, business, savings, other) with return/dividend/sale/loss/fee events;
  goals; net-worth rollup.
- Loans given, with repayments, status, and **monthly interest**. A loan carries
  a per-month rate charged to the borrower; interest is simple, never compounded,
  and accrues on the declining principal, in whole months ticking on the loan
  date's day-of-month — a figure the borrower can check by hand. The loan page
  shows the interest assumed when the term was agreed, the interest accrued to
  date, what settles the loan today, and a month-by-month schedule whose rows sum
  to the total; a settlement-date control projects what a further delay costs
  without recording anything. Repayments settle principal first, so cash above
  principal counts as interest paid. Writing a loan off freezes accrual at that
  date. Interest is derived on read and never stored: `outstanding_balance` stays
  principal only, and outstanding interest is reported beside it rather than
  inside it, so unpaid interest never enters net worth as an asset.
- Clients (business workspaces) / people (personal), with the costs carried on
  their behalf. A recurring outgoing can name the vendor it is paid to and the
  client it is really for, on one of four terms: **own cost**, **at cost**,
  **fixed price**, or **in retainer**. Transactions can be attributed to a client
  so money coming back is matched against money fronted. Recovery accrues when a
  cost is actually paid, not when it is scheduled, and the shortfall is
  cumulative and floored at zero so a renewal settled late does not read as a
  permanent leak. A recovered cost is still an expense and its recovery is still
  income: the two are never netted in the ledger, only in the client view and in
  the overhead split on the outgoings page.
- Debts and credits (credit card, loan, mortgage, overdraft, other) with balance
  snapshots, payments, and per-cycle **statements**: opening and closing balance,
  interest and fees charged, minimum payment, and the interest rate that cycle
  implies shown against the APR on file. When a statement prints several APRs at
  once, interest can be split into per-APR lines (a 0% balance transfer next to
  purchases), each with the rate it implies against its own APR, alongside a
  single blended statement rate. Statement interest is reported as cost of
  borrowing and is deliberately never added to expense totals — the payment is
  already counted and the interest sits inside it.
- Analytics: trend and category charts (Recharts), period filters, CSV export.
- Receipt scanning via any OpenAI-compatible vision endpoint, configured per user in
  Settings, disabled by default; receipt images stored in S3-compatible storage when
  configured.
- First-run onboarding card: workspace currency, optional first budget, optional first
  transaction.
- Light/dark/system theming with dark as the default, toast notifications,
  `prefers-reduced-motion` honored.
- Installable PWA; the service worker caches only static assets (icons, manifest,
  favicon) and never authenticated pages or financial data.

**Constraints:**

- Next.js 16 App Router, React 19, TypeScript, PostgreSQL + Drizzle, Tailwind v4 with
  `@theme` tokens in `app/globals.css`, shadcn/ui + Radix primitives, lucide-react
  icons, Bricolage Grotesque and Geist via `next/font` (self-hosted at build time).
  New UI works within this system rather than adding a parallel one.
- **A default install must remain fully functional with no third-party API keys.** Any
  feature depending on an external service degrades to an explicit, non-blocking
  opt-in. This is a product commitment, not a current convenience.
  *(Decided during init at the user's request.)*
- Currency is per workspace, from a fixed list of 10 (GBP default, plus USD, EUR, NGN,
  KES, ZAR, CAD, AUD, GHS, INR). Amounts are single-currency per workspace; there is no
  FX conversion.
- Copy is English only; no i18n layer exists.
- MIT licensed and public at `github.com/tickideasintl/sika`. Anything shipped is
  readable by self-hosters and contributors.

**Decided — registration and multi-person access:**

- **Bootstrap (v1.0.0):** operator sets `SIKA_SETUP_TOKEN` at deploy; first visitor
  who knows the token creates the first account. Empty-DB open signup is rejected
  because a public instance could be claimed by a bot before the operator arrives.
  The setup token is bootstrap authority, not a product role.
- **Household sharing (shipped):** several identities on one workspace via
  memberships and roles (owner / editor / viewer), provisioned by invitation.
  A workspace is the books; members act as themselves on those books. Isolation
  of money records is the workspace, not the owner.
- **Vocabulary (do not conflate):**
  - *Isolated multi-user* = several private accounts on one server, each with their
    own workspaces (Firefly-style). Still not shared books. Not offered.
  - *Household sharing* = several identities on one workspace via memberships and
    roles. This is present.

**Undecided:**

- Whether isolated multi-user is ever offered, and what the mail-free provisioning
  path would be (likely operator CLI, not open registration).
- Whether bank integration, when it arrives, is allowed to break the zero-third-party
  default (it would need to be opt-in to comply).

## Brand Commitments

**Binding:**

- The name **Sika**, and its meaning — Twi for "money". The rename from SurplusWise is
  shipped in `CHANGELOG.md`, the npm package, the PWA manifest, and the git remote. The
  local directory name `SurplusWise` is legacy and carries no authority.
- MIT license, and attribution to TickIdeas Intl as the publishing org.
- Voice as it stands in shipped copy: plain, concrete, unhyped. "Track your income,
  expenses, and giving in one place. No clutter, no noise." No growth-hacking tone, no
  exclamation marks, no financial-guru urgency.
- Giving is named respectfully and never euphemized, ironized, or upsold.

**Explicitly not binding:**

- The current visual direction — the Sika mark in `public/brand/`, the `#0B0B0D`
  dark canvas recorded as `manifest.json` `theme_color`, the Bricolage Grotesque
  and Geist pairing, and the semantic money palette. A future direction may replace
  all of it.

  These are **chosen, not inherited**: the mark was approved against a specific
  direction and the rest is documented in `DESIGN.md`. Not binding means a
  deliberate redesign may replace them — it does not mean they are free to drift.
  Changing any of them means regenerating `public/icon-192.png`,
  `public/icon-512.png`, `public/apple-touch-icon.png`, `public/og-image.png` and
  `manifest.json` `theme_color` together.

*(Decided during init at the user's request; updated after the Sika brand and the
Quiet Ledger redesign shipped, which replaced the original scaffold defaults — a
wallet glyph, `#3b82f6` blue, and Plus Jakarta Sans.)*

## Evidence on Hand

- **Real:** the running application and its feature set; the public MIT repository and
  CI; `README.md`, `CHANGELOG.md`, `docs/` (setup, migration, go-live checklist);
  `prd.md` as origin document.
- **Absent — must not be fabricated:** user counts, install counts, GitHub stars,
  testimonials, case studies, named customers, press, awards, funding, uptime figures,
  benchmark results, and any measured accuracy claim for receipt scanning.
- The numbers in `prd.md` §6 (90% receipt-capture accuracy, 70% 30-day retention, 4/5
  satisfaction) are **stated goals, never measured**. They may not appear anywhere
  user-facing as achievements.
- There is no pricing, no plans, and no paid tier. Sika is free and self-hosted.
- `jspdf` is a dependency but is imported nowhere. There is no PDF export; CSV is
  the only way numbers leave the app. Do not describe PDF reporting as a feature
  until it exists.

## Product Principles

1. **Giving keeps its own line.** Anywhere money is summarized, categorized, budgeted,
   or exported, giving is visible as its own thing — never folded into expenses to
   simplify a chart.
2. **Entry speed protects the record.** The value of the app is a record that stays
   accurate. Any friction added to capture costs more than the feature it enables.
3. **Nothing leaves the server unless the user sent it.** External calls are opt-in,
   named, and reversible. The default install is silent.
4. **The active workspace is never ambiguous.** Personal and business separation is a
   promise; any UI where a user could enter data into the wrong workspace breaks it.
5. **Say only what is true.** No invented proof, no aspirational metrics presented as
   results, no urgency about someone else's money.

## Accessibility & Inclusion

- **WCAG 2.2 AA is the standard for new and changed UI.** The existing surface has not
  been audited against it; `docs/IMPROVEMENTS.md` carries an open AA audit item. New
  work meets the bar; legacy screens are brought up as they are touched.
  *(Decided during init at the user's request.)*
- Non-negotiables given the domain: numeric data is never conveyed by color alone
  (over/under budget, positive/negative net worth, debt vs asset must carry text or
  shape); amounts use tabular figures; touch targets meet 24px minimum with comfortable
  spacing for one-handed phone entry.
- Radix primitives supply the interaction semantics; keep them rather than rebuilding
  controls.
- `prefers-reduced-motion` is already honored globally in `app/globals.css` and must
  stay honored.
