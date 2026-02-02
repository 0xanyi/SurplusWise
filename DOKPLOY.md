# SurplusWise - Dokploy Deployment Guide

This guide will help you deploy SurplusWise on your self-hosted Dokploy instance.

## Prerequisites

1. A running Dokploy instance
2. A Convex account with a deployed project (https://convex.dev)
3. Your Convex deployment credentials

## Deployment Steps

### Step 1: Prepare Convex for Production

Before deploying, you need to deploy your Convex functions to production:

```bash
# Install Convex CLI if not already
npm install -g convex

# Deploy Convex functions to production
npx convex deploy
```

This will give you your production Convex URL.

### Step 2: Create Application in Dokploy

1. Log into your Dokploy dashboard
2. Click **"Create Project"** (or select an existing project)
3. Click **"Create Service"** → **"Application"**
4. Choose **"Docker"** as the build type

### Step 3: Connect Your Repository

1. Select **Git** as the source
2. Connect your GitHub/GitLab repository or use a Git URL
3. Select the branch you want to deploy (e.g., `main`)

### Step 4: Configure Build Settings

In the **Build** settings:

- **Dockerfile Path**: `Dockerfile` (default)
- **Build Context**: `.` (default)

### Step 5: Set Environment Variables

Navigate to **Environment** and add the following variables:

#### Required Build Args (set in Build section):
```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

#### Runtime Environment Variables:
```
NODE_ENV=production
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

### Step 6: Configure Domain & SSL

1. Go to **Domains** tab
2. Add your custom domain (e.g., `finance.yourdomain.com`)
3. Enable **HTTPS** (Let's Encrypt will auto-provision SSL)
4. Set the container port to `3000`

### Step 7: Configure Resources (Optional)

Recommended resource limits:
- **Memory**: 512MB - 1GB
- **CPU**: 0.5 - 1 core

### Step 8: Deploy

1. Click **Deploy** 
2. Monitor the build logs for any errors
3. Once complete, access your app via your configured domain

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Your Convex deployment URL (ends in `.convex.cloud`) |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Yes | Your Convex site URL (ends in `.convex.site`) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your production app URL (for auth callbacks) |
| `NODE_ENV` | Yes | Set to `production` |

## Convex Dashboard Configuration

Make sure these are set in your **Convex Dashboard** → **Settings** → **Environment Variables**:

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `SITE_URL` | Your production URL (same as `NEXT_PUBLIC_SITE_URL`) |
| `OPENAI_API_KEY` | For AI-powered receipt scanning (optional) |

## Troubleshooting

### Build fails with "standalone" error
Ensure `next.config.js` has `output: "standalone"` set.

### App can't connect to Convex
- Verify `NEXT_PUBLIC_CONVEX_URL` is correct
- Ensure Convex functions are deployed to production

### Authentication issues
- Verify `NEXT_PUBLIC_SITE_URL` matches your actual domain
- Check `SITE_URL` is set correctly in Convex dashboard
- Ensure `BETTER_AUTH_SECRET` is set in Convex dashboard

### Health check failing
The app may take 30-60 seconds to start. Increase the health check `start_period` if needed.

## Updating the App

1. Push changes to your repository
2. In Dokploy, click **Redeploy** or enable auto-deploy from git

## Architecture Notes

- **Frontend**: Next.js 16 (runs in Docker on Dokploy)
- **Backend**: Convex (hosted on convex.cloud - serverless)
- **Auth**: Better Auth with Convex adapter
- **Database**: Convex (real-time document database)

The Docker container only runs the Next.js frontend. All backend logic runs on Convex's serverless infrastructure.
