# Backup and restore

Sika ships operator commands for complete PostgreSQL disaster recovery. These
commands use PostgreSQL 16 custom-format archives, validate every archive before
accepting it, and never overwrite a populated database.

The database archive contains all ledger, workspace, authentication, and app
configuration records. Receipt and supporting-document bytes live in S3-compatible
object storage and must be backed up separately. The Settings **ZIP + files** export
is a useful portable copy of one workspace, but is not a database restore image.

## Requirements

- PostgreSQL 16 `pg_dump` and `pg_restore` available on `PATH`
- `DATABASE_URL` set to the source database
- A destination outside the application host for retained copies

The dump command passes credentials through PostgreSQL environment variables, not
command-line arguments. Protect the archive as sensitive data: it includes account
and session records.

## Create and validate a backup

```bash
set -a; . ./.env.local; set +a
npm run backup:create -- --output backups/sika-$(date -u +%F).dump
```

The command writes to a temporary file, creates a PostgreSQL custom-format dump,
checks that all current Sika tables and the migration journal are present, reads the
entire archive through `pg_restore`, and only then atomically moves it to the requested
path with owner-only file permissions. It refuses to replace an existing file unless
`--force` is supplied.

Validate any retained copy again without connecting to a database:

```bash
npm run backup:validate -- /secure/off-host/sika-2026-08-14.dump
```

When both `NEXT_PUBLIC_SITE_URL` and `BACKUP_REPORT_TOKEN` are set, a successful
`backup:create` reports to Sika only after validation passes. Failed or incomplete
archives are never reported as successful.

Schedule this command with the platform scheduler of your choice. Copy the completed
archive off-host, retain multiple generations, and periodically perform the restore
drill below. A backup that has never been restored is not proven disaster recovery.

## Restore drill or disaster recovery

Create a **new, empty** PostgreSQL database. Do not point the command at the current
Sika database. Set its URL in the restore-only variable, then type the target database
name as confirmation:

```bash
export RESTORE_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/sika_restore'
npm run backup:restore -- /secure/off-host/sika-2026-08-14.dump --confirm sika_restore
```

The restore command:

1. validates the complete archive before connecting to the target;
2. confirms the typed database name matches the URL;
3. refuses any target containing non-system tables or sequences;
4. restores in one transaction with ownership and grants omitted; and
5. runs Sika's schema verification against the restored database.

It has no destructive override. To replace an installation, restore into a new
database, verify the application and object-storage backup against it, then switch the
deployment's `DATABASE_URL` during a controlled maintenance window. Keep the old
database until that verification is complete.

## Object-storage recovery

Enable provider-side bucket versioning or scheduled bucket replication for the S3
bucket named by `S3_BUCKET`. Restore those objects with their original keys before
testing receipt downloads. Database restoration alone cannot recreate file bytes.

For an additional user-readable copy, download **Settings → Data resilience → ZIP +
files** for each workspace. Its `attachments.json` contains SHA-256 checksums that can
be checked independently after extraction.
