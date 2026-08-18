# System Architecture

## Status

Living specification for the desired system. The current repository implements the local CMS, hybrid renderer, routed prod-like test stack, and initial tenant/API boundaries. Deferred capabilities are listed below.

## Purpose

Payload is the source of truth for tenant configuration, page content, media, and publishing state. The web application is a thin renderer of code-defined components and does not own page-building rules.

## Runtime

| Area     | Target                                     | Initial scaffold                   |
| -------- | ------------------------------------------ | ---------------------------------- |
| Monorepo | npm workspaces and Turborepo               | Present                            |
| CMS      | Payload with PostgreSQL                    | Present                            |
| Media    | S3-compatible object storage               | RustFS and Payload adapter present |
| Web      | Next.js hybrid rendering/ISR and Mantine   | Implemented                        |
| Routing  | Caddy path routing, future domain resolver | Path routing implemented           |
| APIs     | Versioned service prefixes                 | Payload `/api` prefix              |

```mermaid
flowchart LR
  Browser --> Caddy
  Caddy --> Web[Next hybrid renderer]
  Caddy --> CMS[Payload CMS]
  CMS --> Postgres[(PostgreSQL)]
  CMS --> Media[(RustFS S3)]
  Web -. cached request/revalidation .-> CMS
```

Tenant resolution is currently `/{tenant}/{slug}`. The resolver boundary is `getPage` in `apps/web/src/lib/cms.ts`; domain and subdomain mapping can be added there without changing component rendering.

## Component model

Blocks are declared in `apps/cms/src/blocks.ts` and therefore cannot be added or changed by editors. Editors configure field values and arrange the approved blocks in a page layout. The renderer maps block slugs to frontend components.

## Access Boundaries

This local demo deliberately does not model role-based CMS administration. Authenticated Payload users may administer shared tenant and media records; this is not a public write surface. Public visitors may read published pages and media through the renderer, but cannot write through Payload access controls. Tenant metadata is public for route discovery and branding. Published page records are not publicly queryable through Payload REST; the web renderer uses the separately configured `CMS_RENDERER_TOKEN`. Every runtime requires `PAYLOAD_SECRET` from the environment.

## Gaps

Authenticated draft preview, domain mapping, CI, editor publishing E2E coverage, media hardening, theme/spacing fidelity, broader component/accessibility coverage, seed export/import, Bruno coverage, backups, and recovery remain follow-up work.
