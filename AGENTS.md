# Repository Guidance

## Purpose

This repository is a local Payload multi-tenant website-builder demo. Payload is the source of truth for tenant configuration, pages, media, drafts, publishing, and preview. The Next.js frontend is a thin CMS-backed renderer.

The demo has three deterministic tenants: `demo1`, `demo2`, and `demo3`. Path prefixes are the current tenant mapping (`/{tenant}/{page}`); host/domain and subdomain mapping are future extension points.

## Documentation

- Keep all documentation under `docs/`; do not put code there.
- `docs/specs/` describes the desired end state and must be self-contained.
- `docs/decisions/` contains immutable decision records. Supersede decisions instead of editing them.
- `docs/runbooks/` contains repeatable, idempotent operational instructions.
- Use Mermaid, tables, and links to avoid unnecessary prose duplication.
- Check documentation and relevant GitHub tickets whenever behavior or architecture changes.

## Architecture

- Use NPM, Node 24+, TypeScript, and Turborepo.
- Applications live under `apps/`; shared packages live under `packages/`.
- `apps/cms` is the official Payload/Next application with admin, REST, auth, uploads, drafts, and preview.
- `apps/web` uses Next.js hybrid rendering/ISR, not `output: "export"`.
- Mantine components and props are preferred over custom CSS; use Tabler icons.
- Payload block schemas are code-owned. Editors configure approved fields and arrange approved blocks only.
- Postgres, RustFS, and Caddy run in Docker. Application processes run on the host for development and managed prod-like tests.
- Caddy is the browser entrypoint. Development defaults to `http://localhost:8888`.
- Keep endpoint configuration explicit with protocol, host, and port variables such as `CMS_PROTOCOL`, `CMS_HOST`, and `CMS_PORT`. Do not introduce duplicate URL and port sources without a concrete boundary need.

## Commands

Scripts are hierarchical and must remain repeatable:

- `npm run dev` starts Docker dependencies and host watch-mode apps through Turborepo.
- `npm run build` builds both applications as standalone artifacts and does not start Docker or seed data.
- `npm run build:managed` runs the seeded prod-like build and managed lifecycle, including Docker dependencies and cleanup.
- `npm run format` formats the entire repository; use `npm run format:scoped -- <path>` for targeted files or directories.
- `npm run validate` is the required complete local gate.
- `npm run test:unit` runs Vitest without a build or service stack.
- `npm run test:playwright` runs isolated web Playwright tests against built artifacts through managed Caddy (including its managed lifecycle).
- `npm run test:e2e` runs full-stack Playwright tests through managed Caddy.
- `npm run test:artillery` runs load tests against the prod-like stack.
- `npm run test:mutation` runs incremental Stryker.
- `npm run check:react-doctor` must be non-interactive (`CI=1`, `-y`, and `--no-telemetry`).

Run the complete `npm run validate` before claiming work is complete. Do not report individual passing suites as equivalent to the full gate.

## Managed Test Lifecycle

- Managed stacks use unique Compose project names and isolated ports for CMS, web, Caddy, Postgres, RustFS, and the RustFS console.
- Explicit test overrides are `TEST_CMS_PORT`, `TEST_WEB_PORT`, `TEST_PROXY_PORT`, `TEST_POSTGRES_PORT`, `TEST_S3_PORT`, and `TEST_S3_CONSOLE_PORT`.
- Managed stack startup reconciles only stale projects matching this repository's `payload-demo-*` naming convention. Never tear down unrelated developer Compose projects.
- Playwright config must pass the selected proxy port to the stack process. If a port is calculated in a test config, export it through `process.env`.
- Generated per-run Next directories are ignored and tracked `next-env.d.ts` references must be normalized after managed runs.
- Payload's generated admin import map must be formatted during the CMS build so a later `format:check` remains stable.
- Normal signal cleanup and Playwright global teardown must both be maintained. Abrupt `SIGKILL` cannot run in-process cleanup, so startup reconciliation is required.

## Testing

- Test behavior and outcomes, not implementation details.
- Unit and integration tests run against source; Playwright and Artillery run against prod-like built artifacts.
- Use Axe-core for WCAG 2.2 AA checks.
- Cross-application tests belong under top-level `tests/`; colocate unit/integration tests with their app or package.
- Keep seed data deterministic and seed runs idempotent.
- Tenant isolation must be enforced in Payload access controls and frontend/API queries.

## GitHub Workflow

- Work on a feature branch, not directly on the base branch.
- Changes go through PRs to `dev`; use stacked PRs where appropriate.
- Use consistent issue structure: context, description, directions, tests, acceptance criteria, and references.
- Update or annotate tickets when implementation changes their context; do not close tickets whose acceptance criteria remain incomplete.
- Commit coherent changes with clear messages and push the branch when the user requests it.

## Engineering Rules

- Inspect the repository and current dependency versions before making assumptions.
- Prefer supported libraries over custom infrastructure, but avoid unnecessary dependencies.
- Keep changes minimal and avoid compatibility layers without a concrete need.
- Use ASCII by default and comments only for non-obvious rationale.
- Never revert unrelated user changes or use destructive Git commands such as `git reset --hard`.
- Do not claim validation passed unless the actual complete command completed successfully.
