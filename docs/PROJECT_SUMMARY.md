# Sika - Project Summary

A modern personal and business finance management application built with Next.js, PostgreSQL, and Better Auth. Features AI-powered receipt scanning, budget tracking, analytics, and workspace-based data isolation for managing personal and business finances separately.

## What Has Been Built

### ✅ Complete Features

**Phase 1: Foundation**

1. **Authentication System**
   - User signup with email/password via Better Auth
   - User login with session management
   - Secure logout functionality
   - Protected routes (can't access dashboard without login)

2. **User Interface**
   - Beautiful landing page with gradient background
   - Responsive login and signup pages
   - Protected dashboard with navigation
   - Mobile-friendly design
   - Toast notifications for user feedback
   - Dark mode support

**Phase 2: Core Features**

3. **Transaction Management**
   - Add, edit, and delete transactions
   - Support for income, expenses, and givings
   - Transaction form with validation
   - Category selection and date picker
   - Search & filter by type, category, and date range (database-level optimization)

4. **Category System**
   - 10 default expense categories + 8 default giving categories
   - Color-coded categories with custom category creation

5. **AI-Powered Receipt Scanning**
   - OpenAI Vision API integration
   - Automatic data extraction from receipts
   - Receipt upload to S3-compatible storage
   - Auto-populate transaction form

**Phase 3: Analytics & Reports**

6. **Analytics Dashboard**
   - Interactive charts with Recharts
   - Spending trends (line charts) and category breakdown (pie charts)
   - Period filtering (weekly, monthly, quarterly, yearly, custom)
   - CSV export

**Phase 4: Budget Tracking**

7. **Budget Management**
   - Create budgets for expense and giving categories
   - Monthly, quarterly, and yearly budget periods
   - Real-time budget vs actual spending tracking
   - Budget progress indicators with color coding

**Phase 5: Postgres Migration (Complete)**

8. **Infrastructure Cutover**
   - Migrated from Convex to PostgreSQL + Drizzle ORM
   - Better Auth switched to Postgres adapter
   - Receipt storage moved to S3-compatible backend
   - Self-hosted deployment via Dokploy

**Phase 6: Finance Workspaces (Complete)**

9. **Workspace System**
   - Personal and Business workspace types
   - Workspace switcher in dashboard navigation
   - All features workspace-scoped (transactions, budgets, categories, outgoings, debts, loans, investments, analytics)
   - Automatic migration of existing data to default "Personal" workspace
   - Create additional workspaces as needed

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | Next.js 16 | Full-stack React framework |
| Runtime | React 19 | Latest React with modern features |
| Language | TypeScript | Type-safe development |
| Database | PostgreSQL 16 + Drizzle ORM | Relational database |
| Auth | Better Auth | Email/password authentication |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | shadcn/ui + Radix UI | Accessible component library |
| Charts | Recharts | Data visualization |
| AI/OCR | OpenAI Vision | Receipt scanning |
| File Storage | S3-compatible | Receipt image storage |
| Deployment | Dokploy | Self-hosted Docker deployment |

## File Structure

```
Sika/
├── app/
│   ├── api/               # API route handlers
│   │   ├── auth/          # Better Auth endpoints
│   │   ├── workspaces/    # Workspace CRUD
│   │   ├── transactions/  # Transaction CRUD
│   │   ├── categories/    # Category CRUD
│   │   ├── budgets/       # Budget CRUD
│   │   ├── analytics/     # Analytics queries
│   │   ├── recurring-outgoings/  # Outgoing bills
│   │   ├── debts-credits/ # Debt tracking
│   │   ├── loans-given/   # Loans tracking
│   │   ├── investments/   # Investment tracking
│   │   └── receipts/      # Receipt scanning & storage
│   ├── dashboard/         # Dashboard pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/
│   ├── ui/                # shadcn/ui components
│   └── dashboard/         # Dashboard components (incl. workspace switcher)
├── contexts/              # React context providers (workspace, etc.)
├── db/
│   ├── schema.ts          # Drizzle ORM schema
│   ├── client.ts          # Postgres connection pool
│   └── migrations/        # SQL migrations
├── lib/
│   ├── db/                # Data-access layer
│   ├── auth.ts            # Better Auth server config
│   ├── auth-client.ts     # Better Auth client
│   ├── auth-server.ts     # Auth server helpers (incl. workspace resolution)
│   ├── storage.ts         # S3 storage helpers
│   └── utils.ts           # Utility functions
├── hooks/                 # Custom React hooks
├── types/                 # Shared TypeScript types
└── docs/                  # Documentation
```

## Getting Started

```bash
npm install
cp .env.example .env.local   # edit with your values
npm run db:migrate
npm run dev
```

See [SETUP.md](./SETUP.md) for detailed instructions including Dokploy deployment.

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:studio    # Open Drizzle Studio
```

---

**Built with ❤️ using modern web technologies**

Last Updated: February 2026
Version: 0.10.0 (Finance Workspaces)
