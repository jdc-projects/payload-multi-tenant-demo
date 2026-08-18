# Local Environment

## Status

Living specification for local operation.

Node 24 is selected via `.nvmrc`. PostgreSQL, RustFS, and Caddy run in Docker. Applications run on the host through Turborepo. Caddy is the single local entrypoint at port `8888`, routing CMS API/admin traffic and frontend traffic. Copy `.env.example` to `.env`, run `npm run dev:infra`, then `npm run dev` and `npm run seed` once the CMS is available.

The target workflow is one command for the complete local stack; this initial scaffold keeps infrastructure startup separate until health checks and orchestration are implemented.
