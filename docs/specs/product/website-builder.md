# Website Builder Product

## Status

Living specification for the desired demo experience.

The product demonstrates three independently branded tenants using one Payload instance. A CMS user selects a tenant, edits page fields, arranges approved components, and publishes. A visitor sees a hybrid-rendered, ISR-backed site at `/demo1/`, `/demo2/`, or `/demo3/`.

The component library should cover hero content, rich text, calls to action, images, video, and feature grids, while allowing practical control over layout spacing, colors, typography, and media. Components must remain safe and predictable: customization is data-driven, not arbitrary editor-authored code.

## Preview and publishing

Payload's authenticated live-preview iframe opens the tenant path with
`?preview=true`. The web renderer forwards the browser's Payload auth cookie to
the CMS and requests `draft=true`; CMS access controls therefore apply the
editor's tenant scope. A visitor, a missing cookie, or a renderer-token request
can only receive published content. Preview responses are never ISR-cached.

Saving or publishing a page sends a signed notification to the web
`/api/revalidate` endpoint. The endpoint invalidates the tenant/page tag and
path, so the next visitor request observes the published version without
invalidating another tenant's page.
