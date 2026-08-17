# Instance registration lock — product spec

**Status:** Decided 2026-08-09  
**Product home:** `PRODUCT.md` (Operating Context + Decided section)

## Problem

Sika is a self-hosted personal finance tool. A public instance with open signup lets
bots or strangers create accounts. Operators need:

1. A deliberate way to create the **first** account after deploy.
2. Signup **closed** after that, at the API — not only by hiding a page.
3. No premature household / multi-user product.

## Decisions

| Decision | Choice |
| --- | --- |
| Accounts per instance (v1) | **Exactly one** |
| First account role | Ordinary user (no admin tier) |
| Bootstrap | `SIKA_SETUP_TOKEN` (server-only env) required while `users` is empty |
| Empty-DB open signup | **Rejected** (bot can claim instance first) |
| After first user | Signup forbidden forever while that account exists |
| Subsequent users (v1) | **None** — no invites, toggles, or user admin |
| SMTP | Not required |
| Household vs multi-user | Deferred; vocabulary locked in `PRODUCT.md` |

## User-visible flows

### Empty instance, token configured

- `/auth/signup` is “Set up this Sika instance”.
- Fields: setup code, name, email, password, confirm password.
- Success → sign-in (or auto session if Better Auth returns one; prefer redirect to login if current client does).

### Empty instance, token missing

- Setup form is not usable; page explains operator must set `SIKA_SETUP_TOKEN`.
- API rejects signup (fail closed).

### Instance already has a user

- `/auth/signup` shows “This instance has already been set up” + link to sign in.
- `POST /api/auth/sign-up/email` returns a generic forbidden/conflict error even with a valid token.
- Landing and login do not advertise “create account”.

### Login

- Always available for the existing account.

## Non-goals (this release)

- Admin / owner roles
- Invite links or codes for additional users
- `ALLOW_REGISTRATION` env toggle as normal ops
- CLI user create (future recovery tool only)
- Household memberships
- CAPTCHA / third-party bot services
- OAuth as bootstrap

## Security requirements

1. Enforce on Better Auth `/sign-up/email`, not UI alone.
2. Timing-safe token compare; token never in URL, logs, or `NEXT_PUBLIC_*`.
3. Race-safe single-account invariant in PostgreSQL.
4. Fail closed if token unset on empty DB.
5. Generic public errors (do not leak user count or token validity details beyond “setup unavailable”).

## Success criteria

- Fresh Docker deploy with token → one setup → login works → second signup fails (UI + API).
- Fresh deploy without token → no account can be created.
- Concurrent double signup with valid token → exactly one user row.
- Existing single-user installs → signup closes without operator action beyond deploying the release.
- Multi-user DBs (if any exist from tests/dev) → migration fails loudly rather than silently picking a survivor.
