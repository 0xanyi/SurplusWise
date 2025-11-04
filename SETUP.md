# SurplusWise Setup Guide

Welcome to SurplusWise! This guide will help you get the application up and running.

## Current Status

✅ **Phase 1 Complete - Foundation Layer**

The following have been successfully implemented:
- Next.js 14 with TypeScript and App Router
- Tailwind CSS + shadcn/ui components
- Supabase authentication system
- Protected dashboard routes
- Responsive UI layout
- PWA-ready configuration

## Quick Start

### 1. Dependencies Already Installed ✅

All npm packages have been installed. If you need to reinstall:
```bash
npm install
```

### 2. Set Up Supabase (Required)

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully set up (takes ~2 minutes)
3. Go to Project Settings → API
4. Copy your project URL and anon key

### 3. Configure Environment Variables

Update the `.env.local` file with your actual Supabase credentials:

```env
# Replace these with your actual Supabase values
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key

# Get an OpenAI API key from https://platform.openai.com
OPENAI_API_KEY=your_actual_openai_key

# This should be correct for local development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set Up Database Tables

Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor):

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
```

### 5. Set Up Storage Bucket for Receipts

In Supabase Dashboard → Storage:

1. Create a new bucket named `receipts`
2. Set it to **Private** (not public)
3. Add the following policies in the Storage Policies tab:

```sql
-- Users can upload own receipts
CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view own receipts
CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete own receipts
CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 6. Configure Email Templates (Optional)

In Supabase Dashboard → Authentication → Email Templates:
- Customize the confirmation email template
- Customize the password reset template

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## What You Can Do Now

✅ **Currently Working:**
- Navigate to the landing page
- Sign up for a new account
- Log in with your credentials
- View the protected dashboard
- Log out
- Responsive design works on mobile and desktop

🚧 **Coming in Phase 2:**
- Add manual transactions (expenses and givings)
- Upload and scan receipts with AI
- View transaction history
- Manage categories
- See dashboard statistics

## Project Structure

```
SurplusWise/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx       # Login page
│   │   ├── signup/page.tsx      # Signup page
│   │   └── callback/route.ts    # Auth callback handler
│   ├── dashboard/
│   │   ├── layout.tsx           # Protected dashboard layout
│   │   └── page.tsx             # Dashboard home
│   ├── layout.tsx               # Root layout with Toaster
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
├── components/
│   ├── ui/                      # Reusable UI components
│   └── dashboard/
│       └── dashboard-nav.tsx    # Dashboard navigation
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   ├── server.ts            # Server Supabase client
│   │   └── middleware.ts        # Auth middleware helper
│   └── utils.ts                 # Utility functions
├── types/
│   ├── database.ts              # Database type definitions
│   └── index.ts                 # Shared types
├── middleware.ts                # Next.js middleware for auth
└── .env.local                   # Environment variables
```

## Testing the Setup

1. **Test Signup:**
   - Go to http://localhost:3000
   - Click "Get Started"
   - Enter email and password
   - Check your email for confirmation

2. **Test Login:**
   - After confirming email, go to login page
   - Enter your credentials
   - You should be redirected to /dashboard

3. **Test Protected Routes:**
   - Try accessing /dashboard without logging in
   - You should be redirected to /auth/login

4. **Test Logout:**
   - Click the logout button in the dashboard
   - You should be redirected to login page

## Next Steps

Once you've verified everything works:

1. Start implementing Phase 2 features (transaction management)
2. Add the receipt scanning functionality
3. Implement dashboard analytics
4. Add data export features

## Troubleshooting

### Build fails with Supabase errors
- Make sure your `.env.local` has valid Supabase credentials
- Restart the dev server after changing environment variables

### Can't log in
- Check that you confirmed your email
- Verify Supabase auth is enabled in your project
- Check browser console for errors

### Middleware errors
- Ensure you're using the latest version of `@supabase/ssr`
- Clear `.next` folder and rebuild: `rm -rf .next && npm run dev`

## Support

For issues or questions:
- Check the README.md for detailed documentation
- Review the Supabase documentation: https://supabase.com/docs
- Review Next.js documentation: https://nextjs.org/docs

Happy coding! 🚀
