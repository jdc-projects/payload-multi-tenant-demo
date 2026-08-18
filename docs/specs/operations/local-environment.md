# Local Environment

## Status

Living specification for local operation.

Node 24 is selected via `.nvmrc`. PostgreSQL, RustFS, and Caddy run in Docker. Applications run on the host through Turborepo. Caddy is the single local entrypoint at port `8888`, routing CMS API/admin traffic, CMS assets, and frontend traffic. Copy `.env.example` to `.env`, run `npm run dev`, then run `npm run seed` once the CMS is available.

`npm run dev` starts infrastructure and both host applications. It owns only the development Compose dependencies and preserves developer data volumes during shutdown. Production-like builds and test suites use separate managed projects, isolated ports, manifests, and cleanup.
