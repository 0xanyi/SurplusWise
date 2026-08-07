# Security Policy

Sika handles personal financial records, so security reports are taken seriously.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately through either channel:

1. [GitHub private vulnerability reporting](https://github.com/tickideasintl/sika/security/advisories/new) (preferred)
2. Email <developer@tickideas.org>

Please include the affected version or commit, reproduction steps, and the impact
you believe it has. A proof of concept helps but is not required.

You can expect an acknowledgement within 72 hours and a status update within
7 days. If a fix is warranted, we will coordinate a disclosure timeline with you
and credit you in the advisory unless you prefer otherwise.

## Supported versions

Fixes land on `main` and ship in the next tagged release. Only the latest release
is supported. Self-hosters should track tagged releases rather than pinning to an
old image.

## Notes for self-hosters

Sika is self-hosted, so the security of your deployment is largely in your hands:

- **Set a strong `BETTER_AUTH_SECRET`.** Generate it with `openssl rand -base64 32`.
  Never reuse the placeholder from `.env.example`.
- **Do not expose Postgres publicly.** The bundled `docker-compose.yml` maps port
  5432 to the host for local development convenience. Remove that mapping in
  production.
- **Change the default database password.** `POSTGRES_PASSWORD` defaults to
  `localdev` for local development only.
- **Serve over HTTPS** and set `NEXT_PUBLIC_SITE_URL` to your real origin, so
  cookies are issued with the correct domain and secure flags.
- **Keep the container updated.** Dependency advisories are checked in CI, but
  that only helps if you pull new images.
- **Back up your database.** Sika has no built-in backup mechanism.

## Third-party services

Receipt scanning and file storage are optional. If you enable them, your data is
sent to those providers under their terms:

- The configured AI provider receives receipt images you choose to scan.
- The configured S3-compatible bucket stores uploaded receipt files.

Leave `OPENAI_API_KEY` and the `S3_*` variables unset to keep everything local.
