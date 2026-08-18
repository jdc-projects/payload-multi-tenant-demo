# Payload demo API

This is a small, executable [Bruno](https://www.usebruno.com/) collection for the
Payload API through Caddy. Import this directory into Bruno and select the
`local` environment. Requests use the numeric `{{proxyPort}}` value, which
defaults to `8888`; set it to the numeric proxy port when running a managed test
stack (for example, `23456`).

## Prerequisites

Start the local stack with `npm run dev` (or build/start the managed stack),
seed it with `npm run seed`, and provide the same values as the CMS in the
environment for `adminEmail`, `adminPassword`, and `rendererToken`. The default
values match `.env.example`. Run requests in order within each folder so the
login response and seeded IDs populate Bruno variables.

The collection covers public tenant and media reads, published page reads via
the renderer token, authenticated login and page draft/publish updates, and
negative public/wrong-token reads and writes. The seeded administrator is a
global administrator in this demo, so a true authenticated cross-tenant write
denial cannot be asserted: tenant-scoped users are not seeded (see
`docs/decisions/0002-demo-access-boundaries.md`). Media upload is intentionally
not included because it requires a real image/video multipart fixture; the
public media route is still exercised.
