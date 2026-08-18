# Demo Access Boundaries

## State

Decided

## Context

The local demo needs enough access for a single authenticated Payload administrator to configure tenants, pages, and media. Full role-based administration and tenant-user management would add product scope that is not required to demonstrate the frontend renderer and path-based tenant mapping.

## Decision

- Authenticated Payload users may administer tenant and media records in the local demo.
- Public visitors may read published pages and media but cannot write through Payload access controls.
- Tenant names, slugs, and themes are publicly readable for route discovery and visitor branding.
- Published page records are not publicly queryable through Payload REST; only the separately configured `CMS_RENDERER_TOKEN` may use the renderer read boundary.
- Role-based tenant administration and protected media ownership remain follow-up work.
- Every runtime must receive `PAYLOAD_SECRET` from the environment; `.env.example` documents the local value and no code-level fallback exists.
- CI, deployments, and GitHub Actions are outside the current local-only demo scope.

## Options

| Option                             | Pros                        | Cons                                     |
| ---------------------------------- | --------------------------- | ---------------------------------------- |
| Full role and tenant ACLs now      | Strongest isolation         | Expands demo scope and admin UX work     |
| Authenticated shared administrator | Minimal, matches local demo | Not suitable as production authorization |

The shared authenticated administrator was selected for the demo boundary. The decision can be superseded when the tenant-admin product model is implemented.
