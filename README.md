# payload-multi-tenant-demo

Multi-tenant CMS demo on Payload

## Development

```sh
npm install
npm run dev
npm run seed
```

The default local entrypoint is `http://localhost:8888`; Caddy routes CMS API/admin/media traffic and frontend traffic through that port. Test suites start and stop their required Docker services, real Payload CMS app, hybrid Next web server, and proxy automatically, selecting isolated ports per run unless `TEST_*` overrides are set. Development endpoints are configured with explicit protocol, host, and port variables; see `docs/runbooks/local-setup.md`.

For creating pages and managing the versioned seed fixture, see `docs/runbooks/content-editing.md`.

`npm run build` creates standalone CMS and web production artifacts. It does not start Docker, connect to services, or seed data. Use `npm run build:managed` when a seeded prod-like CMS, web server, and Caddy lifecycle is required; it allocates isolated ports and cleans up its containers and generated artifacts.

The web renderer requires the separate `CMS_RENDERER_TOKEN` from `.env.example`
to read published pages through the CMS API.

To run the built applications locally through Caddy:

```sh
npm run build
npm run start:infra
npm run seed
npm run start
```

Keep the infrastructure running while seeding and starting the applications. Stop the host applications with `Ctrl-C`, then stop the dependencies with `npx tsx scripts/infra.ts down`.

Run the complete local gate with `npm run validate`. This includes formatting, linting, TypeScript, the managed seeded build, React Doctor, Fallow, unit tests, Playwright, Artillery, and Stryker. Playwright browser binaries can be installed with `npx playwright install chromium`. The web, E2E, and Artillery commands start and stop their own managed prod-like stack.
