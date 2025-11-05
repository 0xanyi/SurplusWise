# SurplusWise - Personal Finance Manager

A modern personal finance management application designed to help users track their expenditures, monitor monthly outgoings, and manage church givings such as tithes and partnerships. Built with AI-powered receipt scanning for seamless transaction capture.

## Features

### Current Features (Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 ✅)

**Authentication & Security**
- ✅ User authentication (signup, login, logout)
- ✅ Secure session management with Supabase
- ✅ Row-level security policies

**Transaction Management**
- ✅ Manual transaction entry (expenses and givings)
- ✅ CRUD operations for all transactions
- ✅ Search and filter transactions
- ✅ Date range filtering
- 🤖 AI-powered receipt scanning with OpenAI Vision
- ✅ Receipt upload and storage

**Analytics & Reports**
- 📊 Interactive analytics dashboard with charts
- 📈 Spending trends visualization (line charts)
- 🥧 Category breakdown (pie charts)
- 📅 Period-based filtering (weekly, monthly, quarterly, yearly, custom)
- 💾 CSV data export
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
- ✅ Toast notifications
- ✅ PWA-ready configuration
- ✅ Mobile-friendly design

### Upcoming Features
- 💾 PDF report generation
- 🔔 Push notifications
- 🌙 Dark mode support
- 📱 Advanced filtering options
- 🏦 Bank integration
- 💰 Budget tracking
- 🔮 Spending predictions

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router with Turbopack)
- **Language**: TypeScript
- **Runtime**: React 19.0.0
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI/OCR**: OpenAI Vision API
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account ([signup here](https://supabase.com))
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
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up Supabase database:

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('expense', 'giving')) NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('expense', 'giving')) NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can view own transactions" 
  ON transactions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
  ON transactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" 
  ON transactions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" 
  ON transactions FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for categories
CREATE POLICY "Users can view own categories" 
  ON categories FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
  ON categories FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
  ON categories FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
  ON categories FOR DELETE 
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at 
  BEFORE UPDATE ON transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false);

-- Create storage policy
CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
```

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
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── lib/
│   ├── supabase/       # Supabase client configuration
│   ├── openai/         # OpenAI client configuration
│   └── utils.ts        # Utility functions
├── types/
│   ├── database.ts     # Database type definitions
│   └── index.ts        # Shared types
├── hooks/              # Custom React hooks
├── public/             # Static assets
└── middleware.ts       # Next.js middleware for auth
```

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
- [x] Period-based filtering (weekly, monthly, quarterly, yearly, custom)
- [x] Interactive spending trends
- [x] Category breakdown visualizations
- [x] Data export (CSV)
- [x] Custom category management (CRUD)

### Phase 4: Polish & Enhancements
- [ ] Dark mode
- [ ] Mobile optimization
- [ ] Push notifications
- [ ] Advanced filtering

### Phase 5: Advanced Features
- [ ] Bank integration
- [ ] Budget tracking
- [ ] Spending predictions
- [ ] Multi-user support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For support, email support@surpluswise.com or open an issue in the repository.
