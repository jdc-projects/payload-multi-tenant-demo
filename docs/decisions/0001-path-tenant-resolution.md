# ADR 0001: Path Tenant Resolution

## State

decided

## Context

The demo needs three tenants locally without requiring DNS or deployment infrastructure.

## Decision

Use the first URL path segment as the tenant slug: `/{tenant}/{page-slug}`. Keep resolution behind the CMS client so domain and subdomain strategies remain possible later.

## Options

| Option           | Pros                                    | Cons                              |
| ---------------- | --------------------------------------- | --------------------------------- |
| Path prefix      | Works on localhost, easy to demonstrate | Requires routing/rewrite handling |
| Domain/subdomain | Production-friendly branding            | Needs DNS and local hosts setup   |

Path prefixes are the least infrastructure-dependent choice for the initial demo.
