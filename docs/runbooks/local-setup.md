# Local Setup

## Context

This runbook starts the initial local Payload multi-tenant demo.

## Execution

1. Install Node 24 and run `npm install`.
2. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
3. Run `npm run dev`.
4. Run `npm run seed` after the CMS is listening.

## Validation

Open `http://localhost:8888/admin`, then visit `http://localhost:8888/demo1/`, `demo2`, and `demo3`. CMS admin assets are served through the `/cms/_next/` proxy route. Re-running the seed must not create duplicate tenants or home pages. Stop the command with Ctrl-C; development data volumes are retained.

## Builds and managed tests

`npm run build` is a standalone artifact build. It does not start Docker, require a running database or object store, or seed content. `npm run build:managed` is the explicit managed alternative: it starts isolated Docker dependencies, builds and seeds the CMS, builds the web artifact, and removes the stack and generated directories on completion.

`npm run test:playwright`, `npm run test:e2e`, and `npm run test:artillery` each use the same managed lifecycle automatically. They select isolated ports unless `TEST_*` overrides are supplied.

## Seed fixtures

The versioned normalized fixture at `apps/cms/src/fixtures/v1.json` can be exported or imported without generated IDs and timestamps:

```sh
npm run seed:export -- /tmp/site-fixture.json
npm run seed:import -- /tmp/site-fixture.json
```

Import is non-destructive by default. Existing records with changed editor content are reported and skipped; use the explicit `--force` flag only when replacement is intentional. Media entries are references (identified by filename), not binary uploads, so importing a fixture never deletes or replaces media files. Both commands are non-interactive and safe to run repeatedly.

## Port Overrides

The default development ports are configurable without changing source files:

- `CMS_PROTOCOL`, `CMS_HOST`, and `CMS_PORT` for Payload/Next CMS
- `WEB_PROTOCOL`, `WEB_HOST`, and `WEB_PORT` for the Next frontend

Tenant routing defaults to path prefixes. For host-based local testing, configure
`TENANT_RESOLUTION_STRATEGY`, `TENANT_TRUSTED_HOSTS`, and either
`TENANT_DOMAIN_MAP` or `TENANT_BASE_DOMAIN` as described in
[ADR 0003](../decisions/0003-configurable-tenant-resolution.md). Do not enable
host-based routing without an explicit trusted-host list.

- `PROXY_PROTOCOL`, `PROXY_HOST`, and `PROXY_PORT` for Caddy
- `POSTGRES_PROTOCOL`, `POSTGRES_HOST`, and `POSTGRES_PORT` for PostgreSQL
- `S3_PROTOCOL`, `S3_HOST`, and `S3_PORT` for RustFS S3
- `S3_CONSOLE_PORT` for the RustFS administration console

The CMS uses `S3_BUCKET` as its media bucket. On every startup it attempts an
idempotent create and then performs a bucket HEAD request; an unavailable or
unauthorized bucket fails startup rather than allowing records whose objects
cannot be served. Media uploads are authenticated, limited to image/video MIME
types, and capped at 25 MiB. Reads remain public through Payload's media route
and Caddy's `/media/*` proxy path.

Managed suites also accept `TEST_CMS_PORT`, `TEST_WEB_PORT`, `TEST_PROXY_PORT`, `TEST_POSTGRES_PORT`, `TEST_S3_PORT`, and `TEST_S3_CONSOLE_PORT`. Managed suites select isolated application, proxy, database, and RustFS ports automatically; the `TEST_*` values override them when needed. For example:

```sh
CMS_HOST=localhost CMS_PORT=4101 WEB_HOST=localhost WEB_PORT=4100 PROXY_HOST=localhost PROXY_PORT=4888 npm run dev
TEST_CMS_PORT=5101 TEST_WEB_PORT=5100 TEST_PROXY_PORT=5888 npm run test:e2e
```
