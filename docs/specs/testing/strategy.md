# Testing Strategy

Unit and integration tests use Vitest against source. Playwright web tests isolate the frontend; E2E tests exercise the full CMS and web stack in prod-like mode. Axe-core checks target WCAG 2.2 AA. Artillery covers important APIs and visitor flows. Stryker runs incrementally for affected workspaces; a future CI target may run it fully on merges to `dev`. CI and GitHub Actions are intentionally out of scope for the local-only demo.

Every vertical slice should cover component outcomes, tenant isolation, seed idempotency, API behaviour, accessibility, and the relevant visual/user flow. No automated suite targets dev mode.

## Commands

`npm run test` is the aggregate test command. It runs unit tests, isolated web Playwright tests, E2E Playwright tests, Artillery smoke/load tests, and Stryker mutation testing. Individual suites are available as `test:unit`, `test:playwright`, `test:e2e`, `test:artillery`, and `test:mutation`.

`npm run build` is a standalone artifact build and must not start Docker or seed data. `npm run build:managed` is the explicit seeded prod-like build used by `npm run validate`; it starts and cleans up its isolated lifecycle. `npm run validate` runs formatting, linting, TypeScript, the managed build, React Doctor, Fallow, and the complete test command.

Playwright requires browser binaries. The web, E2E, and Artillery commands start their Docker dependencies, real Payload CMS app, hybrid Next web server, and Caddy proxy automatically, then stop host processes before removing managed containers, volumes, and generated build directories. These commands use the managed lifecycle rather than the standalone `build` command. External environment runs can be added later as a separate explicitly configured target.
