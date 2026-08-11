# Per-APR interest buckets — product spec

**Status:** Decided 2026-08-11  
**Product home:** `PRODUCT.md` (Debts / statements)  
**Implementation plan:** *(pending)*  
**Column:** `debt_statements.interest_breakdown` (jsonb, already present; was reserved)

## Problem

A single statement-level interest total and one optional `balance_subject_to_interest`
produce one blended EAR. Real credit-card statements often print several APR lines
side by side — e.g. a 0% balance transfer next to purchases at 24.9%, plus cash
advances. The blend hides which balance is costing money and makes variance against
the single APR on file noisy or meaningless.

The column was reserved at statement launch for exactly this. v1 fills it.

## Goals

1. **Enter** a statement the way the issuer prints multi-APR lines.
2. **See** per-bucket cost and implied EAR, plus a blended statement rate.
3. Keep the default close flow to **three numbers** when there is only one rate.

## Non-goals

- Analytics / cost-of-borrowing broken down by bucket type
- Statement edit UI (PATCH accepts breakdown; create dialog only for split UI)
- Fee breakdown per bucket
- Payment allocation across buckets
- Promoting jsonb to a child table
- Auto-detect from imports / Plaid
- Changing the accounting stance (statement interest is still not an expense; still
  reported as `costOfBorrowing`)

## Decisions

| Decision | Choice |
| --- | --- |
| Storage | Existing `interest_breakdown` jsonb (Approach 1) |
| When split appears | Optional — “Split by APR”; default stays single total |
| Bucket fields | type + optional label + basis + interest + optional APR |
| Source of truth when split | Buckets win; top-level interest and basis are **sums** |
| Labels | Preset `type` + optional free-text `label` |
| Statement-level basis when split | Sum of bucket bases (same rule as interest) |
| Surfaces | Close-statement dialog (entry + live preview) + debt detail expand |
| Split UI debt types | Revolving only (`credit_card`, `overdraft`); API accepts any type |
| Max buckets | 8 per statement |
| Migration / backfill | None — column exists; existing rows stay `null` |

## Data model

`debt_statements.interest_breakdown`: `null` or a JSON array.

```ts
type InterestBucketType =
  | "purchases"
  | "balance_transfer"
  | "cash_advance"
  | "promotional"
  | "other"

interface InterestBucket {
  type: InterestBucketType
  label?: string | null // optional override of the preset name
  balanceSubjectToInterest: number // >= 0; printed basis for that line
  interestCharged: number // >= 0
  apr?: number | null // advertised APR for this line, percent
}
```

### Invariants (app-enforced on create/update)

1. `null` or omitted breakdown = today’s behaviour (single totals only).
2. Empty array `[]` is stored as `null` (no split).
3. When breakdown is non-empty:
   - every bucket has a valid `type` and non-negative finite
     `balanceSubjectToInterest` and `interestCharged`
   - `interest_charged` column = sum of bucket `interestCharged`
   - `balance_subject_to_interest` column = sum of bucket `balanceSubjectToInterest`
   - client top-level totals are ignored and overwritten from the sums
4. At most 8 buckets.
5. `label` is trimmed; empty → `null`; max length 60.
6. No backfill of existing rows.

### Derivation (pure, `lib/debt-interest.ts`)

Add small helpers alongside `deriveRate` (do not change `deriveRate`’s own
null-on-zero-basis contract — that stays correct for statement-level use):

- **`sumInterestBreakdown(buckets)`** → `{ interestCharged, balanceSubjectToInterest }`
  or `null` when there is no split.
- **`normaliseInterestBreakdown(input)`** → validated array or `null` (`[]` → `null`,
  trim labels, drop empty).
- **`deriveBucketRate(bucket, periodStart, periodEnd)`** → `DerivedRate | null`:
  - basis > 0: same EAR maths as `deriveRate` with printed basis → `estimated: false`
  - basis 0 and interest 0 → `{ periodRatePercent: 0, annualisedPercent: 0, basis: 0,
    estimated: false, periodDays }` (a real 0% line with nothing subject to interest)
  - basis 0 and interest > 0 → `null` (meaningless)
  - broken period → `null`
- **Blended statement rate:** existing `deriveRate` on the derived column totals
  (exact when breakdown is present, because basis is the sum of printed bases).
- **Per-bucket variance:** `getRateVariance(bucketRate, bucket.apr)`.
- **Statement-level variance** vs the debt’s single APR on file stays as today
  (blended vs on-file) — coarse flag only.

Fees, amortising `principal_paid` / `interest_paid`, and payment settlement are
unchanged and stay statement-level.

## API and service layer

### Write (`POST` create, `PATCH` update)

Accept camelCase or snake_case, consistent with existing statement routes:

- Body field: `interestBreakdown` / `interest_breakdown`
- Bucket fields: camelCase or snake_case

| Input | Stored |
| --- | --- |
| No breakdown / `null` / `[]` | `interest_breakdown = null`; top-level interest and basis as sent |
| Non-empty breakdown | Validate → sum → write column totals from sums → store array |

- Update with `interestBreakdown: null` clears the split; top-level fields follow
  the rest of the patch (or remain if not patched).
- A new array **replaces** the whole breakdown (no partial bucket patch).
- Invalid buckets → 400 (bad type, negative, non-finite, >8, label too long).
- When breakdown is present, disagreeing client totals are not an error; sums win.

Draft endpoint is unchanged — buckets are never prefilled.

### Read (`ApiDebtStatement`)

Additive field:

```ts
interest_breakdown: Array<{
  type: InterestBucketType
  label: string | null
  balance_subject_to_interest: number
  interest_charged: number
  apr: number | null
  rate: ApiDerivedRate | null
  rate_variance: number | null
}> | null
```

Statement-level `interest_charged`, `balance_subject_to_interest`, and `rate`
remain (blended when breakdown is present). Mapping lives next to the existing
row→API mapper so list and get stay consistent.

### Analytics

Unchanged in v1. `costOfBorrowing` still sums `interest_charged`, which already
equals bucket totals when a split is stored.

## UI

### Close statement dialog (`statement-dialog.tsx`)

- Default path unchanged: closing balance, interest, minimum (plus existing
  “more fields”).
- Revolving debts only: control **“Split by APR”** under Interest.
- Repeater per line: type select, optional label, balance subject to interest,
  interest charged, optional APR, remove.
- **Add line** (disabled at 8).
- While split is on:
  - Top-level Interest and Balance-subject-to-interest are **read-only derived
    totals** from the lines.
  - Live preview: blended rate (as today) plus one preview line per bucket
    (name · interest · annualised % · variance vs line APR if set).
  - Save requires ≥1 valid bucket.
- **“Use single total”** collapses the split, clears buckets, restores editable
  top-level interest/basis.
- Amortising debts: no split control (API still accepts breakdown if sent).
- Create path only for the split UI in v1; PATCH already accepts breakdown for
  API completeness. Full statement-edit dialog remains deferred.

### Debt detail history (`debt-detail.tsx`)

- List row stays compact (period, closing, total interest, blended rate, minimum).
- When `interest_breakdown` is non-null: quiet expand affordance (e.g. chevron or
  “N rates”).
- Expanded: each bucket shows display name (`label` or preset title for `type`),
  interest, basis, implied annualised % (exact), line APR if set, variance when
  ≥1pt (same threshold style as today’s statement variance).
- No expand chrome when breakdown is null.
- Mobile: bucket lines stack as compact text under the row (same pattern as the
  existing sm:hidden restatement).
- Delete unchanged.

## Testing

**Pure logic** (`lib/debt-interest.test.ts`):

- Sum helpers for interest and bases; null/empty → no split totals
- Normalise: trim labels, `[]` → null
- Per-bucket rate: exact basis, 0% promo, basis 0 + interest 0, basis 0 + interest > 0 → null
- Blended rate equals `deriveRate` on summed totals
- Per-bucket variance; null APR → null variance

**Validation / service:**

- Create with breakdown → columns equal sums, jsonb stored
- Create without → jsonb null, columns as sent
- Update replace; update clear with `null`
- Reject bad type, negative, >8, overlong label
- List enrichment returns per-bucket `rate` / `rate_variance` and blended `rate`

No new E2E required for v1. Manual check: card with 0% BT + purchases line.

## Rollout

- No migration, no backfill
- Backward compatible: old clients omit breakdown; responses add
  `interest_breakdown: null`
- `PRODUCT.md` — short note under statements
- `CHANGELOG.md` — Unreleased
- `MEMORY.md` — column status “reserved” → “in use”

## Success criteria

1. Single-rate close flow unchanged in clicks and fields.
2. Multi-rate close: 2+ lines → saved totals match sums → list shows blended rate
   → expand shows per-line EAR and APR variance.
3. Existing statements untouched; full test suite green; new pure tests cover
   bucket maths.

## Promotion note (not in scope)

If analytics later need “interest by type over time” as a first-class SQL series,
promote jsonb rows into a child table in an expand/contract migration. v1 does not
build that path.
