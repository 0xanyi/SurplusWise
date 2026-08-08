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
  summaries. CSV and PDF export exist so the numbers can leave the app.
- The instance is a single-user deployment today. Multi-user and household support are
  roadmap, not present.
- Deployment is Docker Compose or Dokploy on the user's own server; migrations run at
  startup.

## Capabilities and Constraints

**Present:**

- Email/password auth (Better Auth); single user per instance; no admin tier — the
  first account is an ordinary user.
- Workspaces: `personal` and `business` types, multiple allowed, per-workspace
  currency, hard data isolation across every feature.
- Transactions: `income`, `expense`, `giving`; CRUD, search, type/category/date-range
  filtering at the database level.
- Categories: 10 default expense, 8 default giving, plus custom, color-coded,
  per workspace.
- Budgets: monthly / quarterly / yearly, per category, with live spent-vs-allocated
  progress.
- Recurring outgoings with payment logs; debts and credits (credit card, loan,
  mortgage, overdraft, other) with balance logs; loans given with repayments and
  status; investments (stock, crypto, forex, property, business, savings, other) with
  return/dividend/sale/loss/fee events; goals; net-worth rollup.
- Analytics: trend and category charts (Recharts), period filters, CSV export, PDF
  report generation.
- Receipt scanning via any OpenAI-compatible vision endpoint, configured per user in
  Settings, disabled by default; receipt images stored in S3-compatible storage when
  configured.
- First-run onboarding card: workspace currency, optional first budget, optional first
  transaction.
- Light/dark/system theming, toast notifications, `prefers-reduced-motion` honored.

**Constraints:**

- Next.js 16 App Router, React 19, TypeScript, PostgreSQL + Drizzle, Tailwind v4 with
  `@theme` tokens in `app/globals.css`, shadcn/ui + Radix primitives, lucide-react
  icons, Plus Jakarta Sans. New UI works within this system rather than adding a
  parallel one.
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

**Undecided:**

- Whether multi-user / household sharing changes the single-user assumptions above.
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

- The wallet glyph, the `#3b82f6` blue theme color, Plus Jakarta Sans, and the current
  shadcn default look. These are inherited scaffold defaults, not chosen identity, and
  a future visual direction may replace all of them. `public/icon-192.png`,
  `public/icon-512.png`, and `manifest.json` `theme_color` would need regenerating with
  any such change.

*(Decided during init at the user's request.)*

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
- `/og-image.png` and `/apple-touch-icon.png` are referenced in `app/layout.tsx` but do
  not exist in `public/`. Treat as a known asset gap, not as available evidence.

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
