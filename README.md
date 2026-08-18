# payload-multi-tenant-demo

Multi-tenant CMS demo on Payload

## Development

```sh
npm install
npm run dev:infra
npm run dev
npm run seed
```

The default local entrypoint is `http://localhost:8888`; Caddy routes CMS API/admin traffic and frontend traffic through that port. Test suites start and stop their required Docker services, CMS test server, static web server, and proxy automatically.

Run the fast local checks with `npm run validate`. This includes formatting, linting, TypeScript, the production build, React Doctor, Fallow, unit tests, Playwright, Artillery, and Stryker. Playwright browser binaries can be installed with `npx playwright install chromium`. The browser, E2E, and Artillery suites require the relevant prod-like services to be running.
