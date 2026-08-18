# payload-multi-tenant-demo

Multi-tenant CMS demo on Payload

## Development

```sh
npm install
npm run dev
npm run seed
```

The default local entrypoint is `http://localhost:8888`; Caddy routes CMS API/admin/media traffic and frontend traffic through that port. Test suites start and stop their required Docker services, real Payload CMS app, hybrid Next web server, and proxy automatically, selecting isolated ports per run unless `TEST_*` overrides are set. Development endpoints are configured with explicit protocol, host, and port variables; see `docs/runbooks/local-setup.md`.

Run the fast local checks with `npm run validate`. This includes formatting, linting, TypeScript, the production build, React Doctor, Fallow, unit tests, Playwright, Artillery, and Stryker. Playwright browser binaries can be installed with `npx playwright install chromium`. The browser, E2E, and Artillery suites require the relevant prod-like services to be running.
