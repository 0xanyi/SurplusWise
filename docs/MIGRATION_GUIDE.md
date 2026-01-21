# Supabase to Convex + Better Auth Migration Guide

This app has been migrated from Supabase to **Convex** (database/backend) + **Better Auth** (authentication).

## Setup Steps

### 1. Initialize Convex

Run the following command and follow the prompts to log in and create a project:

```bash
npx convex dev
```

This will:
- Create a Convex project (if you don't have one)
- Generate the `convex/_generated/` files
- Deploy your schema and functions to Convex

Keep this running during development.

### 2. Set Environment Variables

#### In Convex Dashboard (https://dashboard.convex.dev)

Add these environment variables:

```
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
SITE_URL=http://localhost:3000  (or your production URL)
OPENAI_API_KEY=<your OpenAI API key for receipt scanning>
```

#### In `.env.local` (local development)

```env
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

This runs both Next.js frontend and Convex backend in parallel.

## Architecture Changes

### Before (Supabase)
- **Auth**: Supabase Auth (email/password)
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage
- **API**: Next.js API routes calling Supabase

### After (Convex + Better Auth)
- **Auth**: Better Auth (email/password) via Convex component
- **Database**: Convex (reactive document database)
- **Storage**: Convex file storage
- **API**: Convex queries/mutations (reactive, real-time)

## Key Files

| Purpose | Old Location | New Location |
|---------|--------------|--------------|
| Auth config | `lib/supabase/` | `convex/auth.ts`, `lib/auth-client.ts` |
| Database schema | SQL files | `convex/schema.ts` |
| Transactions API | `app/api/transactions/` | `convex/transactions.ts` |
| Categories API | `app/api/categories/` | `convex/categories.ts` |
| Budgets API | `app/api/budgets/` | `convex/budgets.ts` |
| Receipt scanning | `app/api/receipts/` | `convex/receipts.ts` |

## Removed Files

- `lib/supabase/` (entire directory)
- `types/database.ts` (Supabase types)
- `proxy.ts` (Supabase middleware)

## Preserved API Routes (Shims)

The following API routes have been preserved for backward compatibility. They now act as shims that wrap the underlying Convex queries and mutations, allowing existing `fetch('/api/...')` calls to continue working:

- `app/api/transactions/` - wraps `convex/transactions.ts`
- `app/api/categories/` - wraps `convex/categories.ts`
- `app/api/budgets/` - wraps `convex/budgets.ts`
- `app/api/receipts/` - wraps `convex/receipts.ts`

This approach enables a gradual migration where components can be updated to use Convex's `useQuery`/`useMutation` hooks incrementally.

## Pending Updates

Some dashboard components still need to be updated to use Convex queries/mutations instead of fetch API:

- `components/dashboard/transaction-form.tsx`
- `components/dashboard/transaction-list.tsx`
- `components/dashboard/budget-overview.tsx`
- `components/dashboard/dashboard-client.tsx`

These components currently use `fetch('/api/...')` which will need to be changed to use Convex's `useQuery` and `useMutation` hooks.

## Performance Optimizations

The following optimizations have been applied:

1. **Database-level date filtering**: The `transactions.list` query uses the `by_userId_date` index with `gte`/`lte` bounds instead of filtering in JavaScript memory.

2. **Efficient recent transactions**: A dedicated `transactions.listRecent` query uses `.order("desc").take(5)` to fetch only required records for the dashboard.

3. **Budget spending calculations**: The `budgets.getWithSpending` query now queries transactions per budget's date range instead of fetching all user transactions.

## Accessing User Data

With Better Auth, user tables are managed internally by the auth component and stored in a separate namespace. To access user data:

**In code:**
```ts
const user = useQuery(api.auth.getCurrentUser);
```

**In Convex Dashboard:** Look for tables prefixed with `betterAuth:` (e.g., `betterAuth:user`, `betterAuth:session`).

## Benefits of Migration

1. **Real-time updates**: Convex provides automatic real-time data sync
2. **Simpler architecture**: No need for separate API routes
3. **Better type safety**: End-to-end TypeScript types from schema to client
4. **Flexible auth**: Better Auth supports multiple providers and plugins
5. **No SQL**: Document-based queries are easier to work with
6. **Optimized queries**: Database-level filtering reduces data transfer
