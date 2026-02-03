# Convex Transactions Pagination + Data Layer Standardization

Date: 2026-02-03

## Goals
- Move the transactions list and mutations to Convex (single data layer).
- Implement pagination with a fixed page size (20) and a clear page/limit UX.
- Remove or deprecate `/api/transactions` endpoints when unused.

## Non-Goals
- Full-text search indexing (search will remain in-memory filter).
- Changing the schema or adding new indices beyond what is already present.

## Architecture Overview
- Add a new Convex query `transactions.listPaginated` that accepts filters (type, category, search, date range) plus `paginationOpts` and returns a paginated result.
- UI consumes `usePaginatedQuery` and manages cursor stacks for Page/Prev/Next behavior.
- Create/update/delete switch to Convex mutations; list updates via Convex reactivity.

## Data Flow
1. UI calls `usePaginatedQuery(api.transactions.listPaginated, { filters..., paginationOpts })`.
2. Convex query applies indexed constraints where possible, orders by date desc, paginates, then applies search filter in memory.
3. UI stores cursor stack to allow Prev/Next navigation and resets pagination when filters change.
4. Mutations (`create`, `update`, `remove`) update Convex; list automatically refreshes.

## UI/UX
- Pagination footer with Prev/Next buttons and `Page X` display.
- Page size fixed at 20.
- Filters reset pagination to page 1.

## Error Handling
- Mutations surface errors via existing toast system.
- Empty state shown when no results; pagination buttons disabled appropriately.

## Implementation Notes
- Use `paginationOptsValidator` from `convex/server`.
- Keep `/app/api/transactions` only if still referenced elsewhere; otherwise remove to avoid duplication.

## Testing
- Manual: create/update/delete transactions and verify list updates without reload.
- Manual: filter and paginate; ensure page reset on filter change.
- Manual: verify Prev/Next behavior and absence of duplicates.
