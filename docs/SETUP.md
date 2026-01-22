# SurplusWise Setup Guide

Welcome to SurplusWise! This guide will help you get the application up and running with Convex + Better Auth.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Convex Project

1. Go to [https://convex.dev](https://convex.dev) and create a project.
2. In the Convex dashboard, copy your **Deployment URL** and **Deployment Name**.
3. In the Convex dashboard → Settings → URL, copy your **Site URL**.

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Convex
CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=your_convex_url
NEXT_PUBLIC_CONVEX_SITE_URL=your_convex_site_url

# Better Auth
SITE_URL=http://localhost:3000
BETTER_AUTH_SECRET=your_secret_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### 4. Initialize Convex

```bash
npx convex dev
```

This will deploy `convex/schema.ts` and initialize the database for local development.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing the Setup

1. Sign up and log in.
2. Add a transaction and confirm it appears in the dashboard.
3. Upload a receipt and verify it attaches to the transaction.
4. Open the analytics dashboard and export CSV/PDF reports.

## Troubleshooting

### Convex not connecting
- Confirm `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` match your Convex project.
- Restart the dev server after changing `.env.local`.

### Auth errors
- Ensure `SITE_URL` matches your local dev URL.
- Regenerate `BETTER_AUTH_SECRET` if sessions fail to validate.

## Support

For issues or questions:
- Check the README.md for detailed documentation
- Review Convex docs: https://docs.convex.dev
- Review Better Auth docs: https://www.better-auth.com/docs
