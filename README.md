# SurplusWise - Personal & Business Finance Manager

A modern finance management application designed to help users track their expenditures, monitor monthly outgoings, and manage church givings such as tithes and partnerships. Built with AI-powered receipt scanning for seamless transaction capture. Supports separate **Personal** and **Business** workspaces so all features are available across both contexts with fully isolated data.

## Features

### Current Features

**Authentication & Security**
- ✅ User authentication (signup, login, logout) with Better Auth
- ✅ Secure session management
- ✅ Email/password authentication

**Transaction Management**
- ✅ Manual transaction entry (expenses, income, and givings)
- ✅ CRUD operations for all transactions
- ✅ Search and filter transactions
- ✅ Date range filtering with database-level optimization
- 🤖 AI-powered receipt scanning with OpenAI Vision
- ✅ Receipt upload and storage via S3-compatible storage

**Budget Tracking**
- ✅ Create budgets for expense and giving categories
- ✅ Monthly, quarterly, and yearly budget periods
- ✅ Real-time budget vs actual spending tracking
- ✅ Budget progress indicators with color coding

**Analytics & Reports**
- 📊 Interactive analytics dashboard with charts
- 📈 Spending trends visualization (line charts)
- 🥧 Category breakdown (pie charts)
- 📅 Period-based filtering (weekly, monthly, quarterly, yearly, custom)
- 💾 CSV data export
- 📄 PDF report generation

**Category Management**
- ✅ Default expense categories (10 categories)
- ✅ Default giving categories (8 categories)
- ✅ Create custom categories
- ✅ Edit and delete custom categories
- ✅ Color-coded categories

**Workspaces**
- ✅ Switch between Personal and Business finance workspaces
- ✅ All features available in both workspaces with separate data
- ✅ Create additional workspaces (personal or business type)
- ✅ Workspace switcher dropdown in dashboard navigation
- ✅ Automatic data isolation — transactions, budgets, categories, debts, loans, investments, and analytics are workspace-scoped

**User Interface**
- ✅ Responsive dashboard layout
- ✅ Modern UI with Tailwind CSS and shadcn/ui
- ✅ Dark mode support
- ✅ Toast notifications
- ✅ PWA-ready configuration
- ✅ Mobile-friendly design

### Upcoming Features
- 🔔 Push notifications
- 📱 Advanced filtering options
- 🏦 Bank integration
- 🔮 Spending predictions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Runtime**: React 19
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Better Auth (Postgres adapter)
- **AI/OCR**: OpenAI Vision API
- **File Storage**: S3-compatible (AWS S3, MinIO, R2, etc.)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deployment**: Dokploy (self-hosted) or any Docker host

## Getting Started

### Prerequisites

- Node.js 22.x (22.13.0 or newer; Node 23+ is not supported) and npm
- PostgreSQL 16+ (local, Neon, Supabase, or Dokploy-managed)
- An OpenAI API key ([get one here](https://platform.openai.com))
- S3-compatible storage for receipt images (optional)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd SurplusWise
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/surpluswise
BETTER_AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key
```

See `.env.example` for the full list including S3 storage vars.

4. Run database migrations (**required**):
```bash
npm run db:migrate
```

> Production note: Docker runtime auto-runs migrations on startup, then verifies
> schema before serving traffic. See Dokploy runbook:
> `docs/PROD_GO_LIVE_CHECKLIST.md`.

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

> For detailed setup instructions (including Dokploy deployment), see [docs/SETUP.md](docs/SETUP.md).
> For production release command order, use [docs/PROD_GO_LIVE_CHECKLIST.md](docs/PROD_GO_LIVE_CHECKLIST.md).
> For future DB changes, use [docs/NEXT_DB_MIGRATION_TEMPLATE.md](docs/NEXT_DB_MIGRATION_TEMPLATE.md).

## Project Structure

```
SurplusWise/
├── app/
│   ├── api/            # API route handlers
│   │   ├── auth/       # Better Auth endpoints
│   │   ├── workspaces/ # Workspace CRUD
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── budgets/
│   │   ├── analytics/
│   │   ├── recurring-outgoings/
│   │   ├── debts-credits/
│   │   ├── loans-given/
│   │   ├── investments/
│   │   └── receipts/
│   ├── dashboard/      # Dashboard pages
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home / landing page
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── contexts/           # React context providers (workspace, etc.)
├── db/
│   ├── schema.ts       # Drizzle ORM schema
│   ├── client.ts       # Postgres connection pool
│   └── migrations/     # SQL migration files
├── lib/
│   ├── db/             # Data-access layer (transactions, budgets, etc.)
│   ├── auth.ts         # Better Auth server config
│   ├── auth-client.ts  # Better Auth client
│   ├── auth-server.ts  # Auth server helpers (incl. workspace resolution)
│   ├── storage.ts      # S3 storage helpers
│   └── utils.ts        # Utility functions
├── hooks/              # Custom React hooks
├── types/              # Shared TypeScript types
└── public/             # Static assets
```

## Database

The application uses PostgreSQL with Drizzle ORM. Main tables:

- **users / sessions / accounts** — managed by Better Auth
- **workspaces** — personal and business finance workspaces per user
- **transactions** — user financial transactions (scoped by workspace, indexed by user, date, type, category)
- **categories** — user-defined and default categories (per workspace)
- **budgets** — budget allocations with period-based tracking (per workspace)
- **recurring_outgoings** — monthly recurring bills and subscriptions (per workspace)
- **debts_credits** — credit cards, loans, and other debts (per workspace)
- **loans_given** — money lent to others (per workspace)
- **investments** — stocks, crypto, property, and other assets (per workspace)

### Database Commands

```bash
npm run db:generate   # Generate SQL migrations from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio GUI
```

## Dependency Maintenance Note

Dependencies were upgraded and the app was verified with:

```bash
npm run lint
npm run build
```

Both commands pass on the current dependency set.

### Remaining npm audit warnings

`npm audit` still reports 5 moderate vulnerabilities from the `drizzle-kit` toolchain:

- `drizzle-kit`
- `@esbuild-kit/esm-loader`
- `@esbuild-kit/core-utils`
- nested `esbuild@0.18.20`

These are all one upstream issue in `drizzle-kit`, which still pulls in the deprecated `@esbuild-kit/esm-loader` chain. A local `npm overrides` attempt was tested and rejected because it produced an invalid dependency tree rather than a clean resolution. `npm audit --omit=dev` reports no high or critical runtime dependency advisories. The Docker image still includes and executes `drizzle-kit` during startup migrations, so scanners may report its five moderate transitive advisories even though the affected esbuild development-server functionality is not used.

Recommended approach:
- do not run `npm audit fix --force` here, because it attempts to downgrade `drizzle-kit`
- wait for an upstream `drizzle-kit` release that removes `@esbuild-kit/esm-loader` / `@esbuild-kit/core-utils`
- re-run `npm audit`, `npm run lint`, and `npm run build` after that upgrade

This affects production startup migration tooling, but the advised esbuild development-server behavior is not used by the migration command or the request-serving Next.js process.

## Development Roadmap

### Completed ✅
- Project setup, auth, UI foundation
- Transaction, category, and budget management
- AI receipt scanning
- Analytics and reports (CSV + PDF export)
- Dark mode, PWA configuration
- PostgreSQL migration (Convex → Postgres + Drizzle)
- Recurring outgoings, debts/credits, loans given, investments tracking
- **Finance workspaces (Personal & Business) with data isolation**

### Next Up
- Bank integration
- Spending predictions
- Multi-user / household support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
