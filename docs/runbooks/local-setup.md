# Local Setup

## Context

This runbook starts the initial local Payload multi-tenant demo.

## Execution

1. Install Node 24 and run `npm install`.
2. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
3. Run `npm run dev:infra`.
4. Run `npm run dev` in another terminal.
5. Run `npm run seed` after the CMS is listening.

## Validation

Open `http://localhost:8888/admin`, then visit `http://localhost:8888/demo1/`, `demo2`, and `demo3`. Re-running the seed must not create duplicate tenants or home pages.

## Port Overrides

The default development ports are configurable without changing source files:

- `CMS_PROTOCOL`, `CMS_HOST`, and `CMS_PORT` for Payload/Next CMS
- `WEB_PROTOCOL`, `WEB_HOST`, and `WEB_PORT` for the Next frontend
- `PROXY_PROTOCOL`, `PROXY_HOST`, and `PROXY_PORT` for Caddy
- `POSTGRES_PROTOCOL`, `POSTGRES_HOST`, and `POSTGRES_PORT` for PostgreSQL
- `S3_PROTOCOL`, `S3_HOST`, and `S3_PORT` for RustFS S3
- `S3_CONSOLE_PORT` for the RustFS administration console

Managed suites also accept `TEST_CMS_PORT`, `TEST_WEB_PORT`, `TEST_PROXY_PORT`, `TEST_POSTGRES_PORT`, `TEST_S3_PORT`, and `TEST_S3_CONSOLE_PORT`. Managed suites select isolated application, proxy, database, and RustFS ports automatically; the `TEST_*` values override them when needed. For example:

```sh
CMS_HOST=localhost CMS_PORT=4101 WEB_HOST=localhost WEB_PORT=4100 PROXY_HOST=localhost PROXY_PORT=4888 npm run dev
TEST_CMS_PORT=5101 TEST_WEB_PORT=5100 TEST_PROXY_PORT=5888 npm run test:e2e
```
