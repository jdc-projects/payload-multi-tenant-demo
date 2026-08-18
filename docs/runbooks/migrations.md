# Database migrations

## Current status

The CMS uses Payload 3 with `@payloadcms/db-postgres` and has no checked-in
Payload migration files today. The adapter does not configure a migration
directory or migration scripts; schema behavior therefore follows Payload's
adapter defaults for the current environment. There is no `npm run migrate`
script and no migration step in the seed command. Treat a schema change as a
deployment change, not as a reason to run `npm run seed`.

Before changing collections or fields, inspect the database and take a backup
using [the backup runbook](./backups-recovery.md). The seed is deterministic
demo content; it is not a migration or a backup.

## Forward migration procedure

1. Make the collection/block change and run the unit/type checks locally.
2. Start the local stack (`npm run dev`) and let the CMS start once. Confirm
   that the admin and all three tenant pages still load.
3. Take a named PostgreSQL and RustFS backup before deploying (the commands
   below use the active Compose project, not a guessed host port).
4. Deploy the new CMS code and start it against the target database. Observe
   the CMS logs for schema work (or an explicit migration requirement) before
   accepting traffic; this project currently has no checked-in migration to
   run.
5. Run `npm run seed` only when demo fixtures are intentionally required, then
   verify admin login, tenant isolation, drafts/published pages, and media.

If this project later adopts checked-in Payload migrations, add a
`migrations/` directory and package scripts around the Payload CLI before
deploying them. The forward commands are then, from the repository root:

```sh
npx payload migrate:create <description>
npx payload migrate
npx payload migrate:status
```

Do not run `migrate:fresh` against a persistent database. It is destructive and
is appropriate only for a disposable local/test database.

## Test and port note

`npm run test:e2e`, `npm run test:playwright`, and `npm run test:artillery` use
disposable Compose projects and dynamically selected ports. Their values can
be overridden with `TEST_POSTGRES_PORT` and `TEST_S3_PORT` (plus the other
`TEST_*_PORT` variables), but those ports are not the development database.
Do not point a recovery command at a test project unless that project was
explicitly selected and stopped first.
