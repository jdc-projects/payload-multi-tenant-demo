# ADR 0003: Configurable Tenant Resolution

## State

decided

## Decision

Tenant resolution is implemented behind `TenantResolver` in the web application. `path` remains the default and preserves `/{tenant}/{page}`. Deployments may select `domain` (an explicit JSON tenant-to-host map) or `subdomain` (a tenant label below `TENANT_BASE_DOMAIN`).

Only hosts in `TENANT_TRUSTED_HOSTS` are considered. Domain and subdomain requests are rewritten internally to the existing path route, so rendering and CMS tenant filtering remain unchanged. Canonical URLs retain the public host for domain strategies; CMS preview URLs use the configured strategy and fall back to the path URL.

## Configuration

| Variable                     | Meaning                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `TENANT_RESOLUTION_STRATEGY` | `path` (default), `domain`, or `subdomain`               |
| `TENANT_TRUSTED_HOSTS`       | comma-separated exact hosts or `*.example.test` patterns |
| `TENANT_DOMAIN_MAP`          | JSON object such as `{ "demo1": "acme.example.test" }`   |
| `TENANT_BASE_DOMAIN`         | base domain for subdomain resolution                     |
| `NEXT_PUBLIC_PREVIEW_URL`    | optional safe path base for CMS previews                 |
