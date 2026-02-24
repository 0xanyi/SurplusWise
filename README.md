# SurplusWise - Personal Finance Manager

A modern personal finance management application designed to help users track their expenditures, monitor monthly outgoings, and manage church givings such as tithes and partnerships. Built with AI-powered receipt scanning for seamless transaction capture.

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

- Node.js 20+ and npm
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

## Project Structure

```
SurplusWise/
├── app/
│   ├── api/            # API route handlers
│   │   ├── auth/       # Better Auth endpoints
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── budgets/
│   │   ├── analytics/
│   │   └── receipts/
│   ├── dashboard/      # Dashboard pages
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home / landing page
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── db/
│   ├── schema.ts       # Drizzle ORM schema
│   ├── client.ts       # Postgres connection pool
│   └── migrations/     # SQL migration files
├── lib/
│   ├── db/             # Data-access layer (transactions, budgets, etc.)
│   ├── auth.ts         # Better Auth server config
│   ├── auth-client.ts  # Better Auth client
│   ├── auth-server.ts  # Auth server helpers
│   ├── storage.ts      # S3 storage helpers
│   └── utils.ts        # Utility functions
├── hooks/              # Custom React hooks
├── types/              # Shared TypeScript types
└── public/             # Static assets
```

## Database

The application uses PostgreSQL with Drizzle ORM. Main tables:

- **users / sessions / accounts** — managed by Better Auth
- **transactions** — user financial transactions (indexed by user, date, type, category)
- **categories** — user-defined and default categories
- **budgets** — budget allocations with period-based tracking

### Database Commands

```bash
npm run db:generate   # Generate SQL migrations from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio GUI
```

## Development Roadmap

### Completed ✅
- Project setup, auth, UI foundation
- Transaction, category, and budget management
- AI receipt scanning
- Analytics and reports (CSV + PDF export)
- Dark mode, PWA configuration
- **PostgreSQL migration (Convex → Postgres + Drizzle)**

### Next Up
- Bank integration
- Spending predictions
- Multi-user / household support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
