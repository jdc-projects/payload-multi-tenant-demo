# Testing Strategy

Unit and integration tests use Vitest against source. Playwright web tests isolate the frontend; E2E tests exercise the full stack in prod-like mode. Axe-core checks target WCAG 2.2 AA. Artillery covers important APIs and visitor flows. Stryker runs incrementally for affected workspaces and fully on merges to `dev`.

Every vertical slice should cover component outcomes, tenant isolation, seed idempotency, API behaviour, accessibility, and the relevant visual/user flow. No automated suite targets dev mode.

## Commands

`npm run test` is the aggregate test command. It runs unit tests, isolated web Playwright tests, E2E Playwright tests, Artillery smoke/load tests, and Stryker mutation testing. Individual suites are available as `test:unit`, `test:playwright`, `test:e2e`, `test:artillery`, and `test:mutation`.

`npm run validate` runs formatting, linting, TypeScript, the production build, React Doctor, Fallow, and the complete test command.

Playwright requires browser binaries. Web and E2E suites require their configured prod-like services; Artillery targets the built web server by default and accepts `ARTILLERY_BASE_URL` for another environment.
