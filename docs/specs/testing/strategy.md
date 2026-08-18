# Testing Strategy

Unit and integration tests use Vitest against source. Playwright web tests isolate the frontend; E2E tests exercise the full stack in prod-like mode. Axe-core checks target WCAG 2.2 AA. Artillery covers important APIs and visitor flows. Stryker runs incrementally for affected workspaces and fully on merges to `dev`.

Every vertical slice should cover component outcomes, tenant isolation, seed idempotency, API behaviour, accessibility, and the relevant visual/user flow. No automated suite targets dev mode.
