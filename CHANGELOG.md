# Changelog

All notable changes to SurplusWise will be documented in this file.

## [0.8.1] - 2026-02-02

### Changed
- Version bump to 0.8.1

## [0.6.1] - 2026-01-22

### Quick Wins & Enhancements ✨

#### Added
- **SEO & Social Media**
  - Comprehensive meta tags with OpenGraph and Twitter Card support
  - Keywords optimization for better search visibility
  - Social media preview images configuration
  - Structured metadata with templates
  - Search engine verification support ready
  - App icons for all platforms (192x192, 512x512, Apple touch icon)

- **User Experience**
  - Custom 404 page with helpful navigation
  - Keyboard shortcuts system for navigation and actions
    - `Ctrl + D` - Go to Dashboard
    - `Ctrl + T` - Go to Transactions
    - `Ctrl + R` - Go to Reports
    - `Ctrl + ,` - Go to Settings
    - `?` - Show keyboard shortcuts help
  - Keyboard shortcuts help dialog (`?` key)
  - Version number display in footer (v0.6.1)

- **Accessibility**
  - Focus trap hook for modal dialogs
  - Focus return hook for better keyboard navigation
  - Improved focus management across the app
  - Better keyboard navigation support

- **Developer Experience**
  - Toast helper utilities for common patterns
  - Undo toast functionality for reversible actions
  - Success and error toast helpers
  - Sitemap.xml generation for SEO
  - Robots.txt configuration

#### Enhanced
- Layout metadata now includes comprehensive SEO properties
- Footer displays version information
- Better structured data for search engines

#### Technical Details
- Added `use-keyboard-shortcuts` hook
- Added `use-focus-trap` hook for accessibility
- Added `toast-helpers` utilities
- Dynamic sitemap generation
- Robots.txt configuration with proper disallow rules

## [0.6.0] - 2025-01-21

### Backend Migration - Supabase to Convex + Better Auth ✅

#### Changed
- **Database**: Migrated from Supabase (PostgreSQL) to Convex (real-time document database)
- **Authentication**: Replaced Supabase Auth with Better Auth using `@convex-dev/better-auth`
- **Schema**: Converted SQL schema to Convex schema with optimized indexes

#### Added
- **Convex Functions**
  - `convex/transactions.ts` - Transaction queries/mutations with optimized date-range filtering
  - `convex/categories.ts` - Category management functions
  - `convex/budgets.ts` - Budget tracking with efficient spending calculations
  - `convex/receipts.ts` - Receipt storage using Convex file storage
  - `convex/auth.ts` - Better Auth integration with Convex adapter

- **Performance Optimizations**
  - `listRecent` query for dashboard - fetches only 5 most recent transactions using `.order("desc").take(5)`
  - Date-range queries use `by_userId_date` index with `gte`/`lte` at database level
  - Budget spending calculations now query only relevant date ranges per budget

- **Database Indexes**
  - `by_userId` - Base user filtering
  - `by_userId_date` - Optimized date range queries
  - `by_userId_type` - Transaction type filtering
  - `by_userId_category` - Category filtering
  - `by_userId_active` - Active budget queries

#### Preserved
- API routes maintained as shims wrapping Convex for backward compatibility
- Existing component interfaces unchanged
- All features continue to work as before

#### Removed
- `lib/supabase/` directory
- `types/database.ts` (Supabase types)
- `proxy.ts` (Supabase middleware)

#### Technical Details
- Better Auth manages user tables in component namespace (not visible in main Convex tables)
- Real-time updates via Convex subscriptions
- End-to-end TypeScript types from schema to client
- Zero SQL required - document-based queries

## [0.5.0] - 2024-11-05

### Phase 4: Polish & Enhancements - Complete ✅

#### Added
- **PDF Report Generation**
  - Export financial reports as PDF with formatted data
  - Professional PDF layout with headers and footers
  - Automatic pagination for large reports
  - Category breakdowns with percentages in PDF
  - Period-based report generation
  - Branded PDF reports with SurplusWise branding

- **Dark Mode Support**
  - System-aware theme detection
  - Manual theme toggle between light and dark modes
  - Smooth theme transitions without flash
  - Dark mode optimized color scheme
  - Theme toggle button in navigation bar
  - Persistent theme preference across sessions

- **Budget Tracking System**
  - Create budgets for expense and giving categories
  - Monthly, quarterly, and yearly budget periods
  - Real-time budget vs actual spending tracking
  - Budget progress indicators with color coding
  - Budget status alerts (ok, warning, exceeded)
  - Visual progress bars for each budget
  - Edit and delete budget functionality
  - Budget overview widget on dashboard

- **Budget Management Features**
  - Full CRUD operations for budgets
  - Automatic date range calculation by period
  - Spent vs remaining calculations
  - Percentage-based progress tracking
  - Status indicators (green for ok, amber for warning, red for exceeded)
  - Budget-to-actual comparisons
  - Category-specific budget allocation
  - Prevent duplicate budgets for same category/period

#### Enhanced
- Navigation bar now includes theme toggle
- Settings page enhanced with budget management section
- Improved color scheme for dark mode compatibility
- Better accessibility with theme support
- Dashboard includes budget overview widget

#### API Routes
- `/api/budgets` - GET (with period/type filters), POST
- `/api/budgets/[id]` - GET, PUT, DELETE

#### UI Components
- ThemeProvider wrapper for theme management
- ThemeToggle button component
- BudgetManagement component with CRUD interface
- BudgetOverview dashboard widget

#### Technical Details
- next-themes integration for seamless theme management
- jsPDF library for PDF generation
- Optimized budget calculations with transaction aggregation
- Real-time budget status updates
- Production build successful with all features
- Zero TypeScript errors

## [0.4.0] - 2024-11-05

### Phase 3: Analytics & Reports - Complete ✅

#### Added
- **Analytics & Reports Page**
  - Interactive charts and visualizations using Recharts
  - Spending trends chart with line graphs
  - Category breakdown with pie charts
  - Period-based filtering (weekly, monthly, quarterly, yearly, custom)
  - Custom date range selection
  - Real-time analytics data
  - Expense and giving comparison charts
  - CSV export functionality for reports

- **Receipt Scanning with AI**
  - OpenAI Vision API integration for receipt scanning
  - Automatic data extraction from receipt photos
  - Support for JPG and PNG images (up to 5MB)
  - Receipt upload to Supabase Storage
  - Receipt preview and confirmation
  - Auto-populate transaction form from scanned data

- **Category Management**
  - Full CRUD operations for custom categories
  - Create new expense and giving categories
  - Edit category names and colors (custom categories)
  - Delete unused custom categories
  - Color picker for category customization
  - Protection for default categories
  - Prevention of deletion for categories in use

- **API Routes**
  - `/api/analytics` - GET analytics data with period filtering
  - `/api/receipts/scan` - POST receipt image for AI scanning
  - `/api/categories/[id]` - PUT, DELETE for category management

- **UI Components**
  - ReceiptScanner component with image preview
  - AnalyticsCharts component with interactive visualizations
  - CategoryManagement component with CRUD interface
  - Tab interface for manual entry vs receipt scanning
  - Period selector with multiple time ranges

#### Enhanced
- Transaction form now supports receipt scanning mode
- Settings page now includes category management
- Reports page fully functional with real data
- Improved transaction workflow with AI assistance

#### Technical Details
- Lazy-loaded OpenAI client to avoid build-time errors
- Recharts integration for data visualization
- Optimized analytics API with aggregated data
- Base64 image encoding for OpenAI Vision API
- Supabase Storage integration for receipt files
- Production build successful with all features

## [0.3.0] - 2024-11-04

### Phase 2: Core Transaction Management - Complete ✅

#### Added
- **Transaction Management**
  - Complete CRUD operations for transactions (Create, Read, Update, Delete)
  - Transaction form dialog with validation
  - Support for both expense and giving transaction types
  - Real-time transaction list with search and filtering
  - Date, category, and type filters
  - Edit and delete functionality for transactions

- **Category System**
  - Default categories for expenses (10 categories)
  - Default categories for givings (8 categories)
  - Automatic category seeding on first API call
  - Category API routes for future management
  - Color-coded categories

- **Dashboard Enhancements**
  - Real statistics from database
  - Monthly expense and giving totals
  - Net balance calculation (surplus/deficit)
  - Transaction count display
  - Recent transactions preview (last 5)
  - Quick action buttons for adding transactions
  - Dedicated transactions page

- **API Routes**
  - `/api/transactions` - GET (with filters), POST
  - `/api/transactions/[id]` - GET, PUT, DELETE
  - `/api/categories` - GET (with auto-seeding), POST
  - Server-side authentication checks on all routes
  - Comprehensive error handling

- **UI Components**
  - Select dropdown component
  - Dialog modal component
  - Textarea component
  - Transaction form with date picker
  - Transaction list with icons and color coding
  - Filter controls for search and filtering

#### Changed
- Dashboard now shows real data from database instead of placeholders
- Updated navigation to include transactions page
- Modified layout to use system fonts instead of Google Fonts

#### Technical Details
- All API routes use Supabase RLS for security
- Client and server components properly separated
- TypeScript types aligned across components
- Build successful with zero errors
- Production-ready code

## [0.2.0] - 2024-11-04

### Updated to Next.js 16 and React 19 🚀

#### Changed
- **Framework:** Upgraded Next.js from 14.2.18 to 16.0.1
- **Runtime:** Upgraded React from 18.3.1 to 19.0.0
- **Runtime:** Upgraded React DOM from 18.3.1 to 19.0.0
- **Build Tool:** Now using Turbopack by default (Next.js 16 feature)
- **Types:** Updated @types/react and @types/react-dom to v19
- **Linting:** Updated ESLint from v8 to v9
- **Config:** Updated eslint-config-next to 16.0.1

#### Fixed
- Migrated from `middleware.ts` to `proxy.ts` (Next.js 16 convention)
- Updated middleware function export to `proxy` function
- Replaced deprecated `images.domains` with `images.remotePatterns` in next.config.js
- Resolved all deprecation warnings

#### Technical Details
- Build continues to work successfully with React 19
- All peer dependency warnings are expected (Radix UI libraries will update soon)
- Application fully compatible with React 19's new features
- Turbopack provides faster development builds

## [0.1.0] - 2024-11-04

### Phase 1: Foundation Layer - Complete ✅

#### Added
- **Project Setup**
  - Initialized Next.js 14 with TypeScript and App Router
  - Configured Tailwind CSS for styling
  - Integrated shadcn/ui component library
  - Set up ESLint for code quality

- **Authentication System**
  - Supabase authentication integration with `@supabase/ssr`
  - User signup page with email/password validation
  - User login page with form validation
  - Logout functionality
  - Protected routes with middleware
  - Auth callback handler for email verification
  - Session management across server and client

- **UI Components**
  - Button component with multiple variants
  - Card components for content display
  - Input and Label components for forms
  - Toast notification system
  - Toaster provider for app-wide notifications

- **Database Setup**
  - TypeScript type definitions for database schema
  - Transaction table schema (ready for Phase 2)
  - Category table schema (ready for Phase 2)
  - Supabase client configuration for browser and server

- **Dashboard**
  - Protected dashboard layout with navigation
  - Responsive navigation bar
  - Dashboard home page with placeholder stats
  - Quick action buttons
  - Mobile-responsive design

- **Landing Page**
  - Marketing homepage with call-to-action
  - Automatic redirect to dashboard for logged-in users
  - Gradient background design

- **PWA Configuration**
  - Web app manifest for progressive web app support
  - Theme color and viewport configuration
  - Installable on mobile devices

- **Documentation**
  - Comprehensive README with project overview
  - Detailed SETUP.md with step-by-step instructions
  - Environment variable templates
  - SQL schema for database setup
  - Troubleshooting guide

#### Technical Stack
- **Framework:** Next.js 14.2.18
- **Language:** TypeScript 5.x
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS 3.4.1
- **UI Components:** Radix UI primitives + shadcn/ui
- **Icons:** Lucide React
- **Build Tool:** Next.js with Turbopack support

#### Project Structure
```
✅ Authentication flows (signup, login, logout)
✅ Protected routes with middleware
✅ Responsive dashboard layout
✅ UI component library
✅ Database schema and types
✅ Environment configuration
✅ Build and deployment ready
```

### Coming Next

#### Phase 2: Core Features (Planned)
- [ ] Manual transaction entry (expenses and givings)
- [ ] Transaction list with CRUD operations
- [ ] Category management system
- [ ] Receipt upload functionality
- [ ] OpenAI Vision API integration for receipt scanning
- [ ] Dashboard statistics with real data
- [ ] Transaction filtering by date range
- [ ] Search functionality

#### Phase 3: Analytics & Reports (Planned)
- [ ] Visual charts with Recharts
- [ ] Period-based analytics (monthly, quarterly, custom)
- [ ] Category breakdown charts
- [ ] Spending trends visualization
- [ ] CSV export functionality
- [ ] PDF report generation

#### Phase 4: Polish & Enhancements (Planned)
- [ ] Dark mode support
- [ ] Advanced filtering options
- [ ] Budget tracking
- [ ] Spending predictions
- [ ] Push notifications
- [ ] Offline support
- [ ] Performance optimization

---

## Development Notes

### Build Status
✅ Production build successful
✅ All TypeScript types passing
✅ ESLint checks passing
✅ No security vulnerabilities in dependencies

### Current Features
- Full authentication flow working
- Protected routes enforced
- Responsive design verified
- Database schema ready for Phase 2
- All UI components tested and working

### Known Issues
None - Phase 1 is complete and stable

### Performance
- First Load JS: ~87-94 kB
- Lighthouse Score: Not yet measured (will measure in Phase 4)

---

**Format:** Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
