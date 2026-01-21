# SurplusWise - Personal Finance Manager

A modern personal finance management application designed to help users track their expenditures, monitor monthly outgoings, and manage church givings such as tithes and partnerships. Built with AI-powered receipt scanning for seamless transaction capture.

## Features

### Current Features

**Authentication & Security**
- ✅ User authentication (signup, login, logout) with Better Auth
- ✅ Secure session management
- ✅ Email/password authentication

**Transaction Management**
- ✅ Manual transaction entry (expenses and givings)
- ✅ CRUD operations for all transactions
- ✅ Search and filter transactions
- ✅ Date range filtering with database-level optimization
- 🤖 AI-powered receipt scanning with OpenAI Vision
- ✅ Receipt upload and storage via Convex

**Budget Tracking**
- ✅ Create budgets for expense and giving categories
- ✅ Monthly, quarterly, and yearly budget periods
- ✅ Real-time budget vs actual spending tracking
- ✅ Budget progress indicators with color coding
- ✅ Optimized spending calculations with date-range queries

**Analytics & Reports**
- 📊 Interactive analytics dashboard with charts
- 📈 Spending trends visualization (line charts)
- 🥧 Category breakdown (pie charts)
- 📅 Period-based filtering (weekly, monthly, quarterly, yearly, custom)
- 💾 CSV data export
- 📄 PDF report generation
- ✅ Real-time financial summaries

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
- 💾 PDF report generation
- 🔔 Push notifications
- 📱 Advanced filtering options
- 🏦 Bank integration
- 🔮 Spending predictions

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router with Turbopack)
- **Language**: TypeScript
- **Runtime**: React 19.2.3
- **Database**: Convex (real-time document database)
- **Authentication**: Better Auth with Convex adapter
- **AI/OCR**: OpenAI Vision API
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Convex account ([signup here](https://convex.dev))
- An OpenAI API key ([get one here](https://platform.openai.com))

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

Create a `.env.local` file in the root directory:

```env
# Convex Configuration
CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=your_convex_url
NEXT_PUBLIC_CONVEX_SITE_URL=your_convex_site_url

# Better Auth Configuration
SITE_URL=http://localhost:3000
BETTER_AUTH_SECRET=your_secret_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
```

4. Initialize Convex:

```bash
npx convex dev
```

This will set up your Convex database with the schema defined in `convex/schema.ts`.

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
SurplusWise/
├── app/
│   ├── auth/           # Authentication pages (login, signup)
│   ├── dashboard/      # Dashboard pages
│   ├── api/            # API routes (shims wrapping Convex)
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── convex/
│   ├── schema.ts       # Database schema
│   ├── transactions.ts # Transaction queries/mutations
│   ├── categories.ts   # Category queries/mutations
│   ├── budgets.ts      # Budget queries/mutations
│   ├── receipts.ts     # Receipt storage functions
│   ├── auth.ts         # Better Auth integration
│   └── auth.config.ts  # Auth configuration
├── lib/
│   ├── openai/         # OpenAI client configuration
│   ├── auth-client.ts  # Better Auth client
│   ├── auth-server.ts  # Better Auth server utilities
│   └── utils.ts        # Utility functions
├── types/
│   └── index.ts        # Shared types
├── hooks/              # Custom React hooks
└── public/             # Static assets
```

## Database Schema (Convex)

The application uses three main collections:

- **transactions**: User financial transactions with indexed queries by userId, date, type, and category
- **categories**: User-defined and default categories for organizing transactions
- **budgets**: Budget allocations with period-based tracking

Authentication tables (users, sessions, accounts) are managed by the Better Auth component.

## API Architecture

The app uses a hybrid approach:
- **Direct Convex queries/mutations**: Used in client components via `useQuery` and `useMutation` hooks
- **API route shims**: Preserved for backward compatibility, wrapping Convex functions

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and configuration
- [x] Authentication system
- [x] Basic UI components
- [x] Dashboard layout

### Phase 2: Core Features ✅
- [x] Transaction management (CRUD)
- [x] Category management
- [x] Receipt scanning with AI
- [x] Dashboard statistics

### Phase 3: Analytics & Reports ✅
- [x] Visual charts and graphs
- [x] Period-based filtering
- [x] Data export (CSV)
- [x] Custom category management

### Phase 4: Polish & Enhancements ✅
- [x] Dark mode
- [x] Budget tracking
- [x] **Migration to Convex + Better Auth**

### Phase 5: Advanced Features
- [ ] Bank integration
- [ ] Spending predictions
- [ ] Multi-user support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For support, open an issue in the repository.
