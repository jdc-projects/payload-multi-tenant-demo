# Testing Strategy

Unit and integration tests use Vitest against source. Playwright web tests isolate the frontend; E2E tests exercise the full stack in prod-like mode. Axe-core checks target WCAG 2.2 AA. Artillery covers important APIs and visitor flows. Stryker runs incrementally for affected workspaces and fully on merges to `dev`.

Every vertical slice should cover component outcomes, tenant isolation, seed idempotency, API behaviour, accessibility, and the relevant visual/user flow. No automated suite targets dev mode.

## Commands

`npm run test` is the aggregate test command. It runs unit tests, isolated web Playwright tests, E2E Playwright tests, Artillery smoke/load tests, and Stryker mutation testing. Individual suites are available as `test:unit`, `test:playwright`, `test:e2e`, `test:artillery`, and `test:mutation`.

`npm run validate` runs formatting, linting, TypeScript, the production build, React Doctor, Fallow, and the complete test command.

Playwright requires browser binaries. The web, E2E, and Artillery commands start their Docker dependencies, CMS test server, static web server, and Caddy proxy automatically, then clean them up. External environment runs can be added later as a separate explicitly configured target.
