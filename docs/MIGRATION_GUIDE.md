# Migration History

> **Status: Complete** — The Convex → PostgreSQL cutover finished in February 2026.

## Summary

SurplusWise went through two backend migrations:

1. **Supabase → Convex + Better Auth** (v0.5) — moved to Convex's real-time document database with Better Auth for authentication.
2. **Convex → PostgreSQL + Drizzle ORM** (v0.9) — moved to a self-hosted Postgres stack for full infrastructure control.

## Current Architecture (post-migration)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | Better Auth (Postgres adapter) |
| File Storage | S3-compatible (MinIO / R2 / AWS S3) |
| AI/OCR | OpenAI Vision API |
| Deployment | Dokploy (Docker, self-hosted) |

## What Changed in the Postgres Cutover

- **Database**: Convex document store → PostgreSQL with Drizzle ORM schema and migrations.
- **Auth**: Better Auth Convex adapter → Better Auth Postgres/Drizzle adapter.
- **Data access**: Convex `useQuery`/`useMutation` hooks → Next.js API routes + fetch-based hooks.
- **File storage**: Convex file storage → S3-compatible object storage.
- **Scripts**: Removed `convex dev` / `convex deploy`; pure `next dev` / `next build` + `drizzle-kit` for migrations.
- **Dependencies**: Removed `convex`, `@convex-dev/better-auth`, `npm-run-all`.

## For New Contributors

You do not need to know anything about Convex. The app is a standard Next.js + Postgres application. See [SETUP.md](./SETUP.md) for getting started.
