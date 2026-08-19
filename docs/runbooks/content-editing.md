# CMS Content Editing

## Create A Page

1. Start the local stack and open `http://localhost:8888/admin`.
2. Sign in with `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD` from `.env`.
3. Open **Pages** and choose **Create new**.
4. Select one of the three tenants. The tenant relationship is required and determines the public route.
5. Enter a title and a slug such as `about`. The page will be available at `/{tenant}/{slug}/`.
6. Add approved blocks to **Layout** using the block selector, then configure their fields:

| Block          | Use                                                |
| -------------- | -------------------------------------------------- |
| Hero           | Page introduction, heading, body, and actions      |
| Rich text      | Editorial copy, headings, lists, and links         |
| Call to action | A focused heading, message, and link               |
| Image          | An uploaded image with required alternative text   |
| Video          | An uploaded video with optional poster and caption |
| Feature grid   | A heading and one or more feature cards            |

7. Save as a draft, use **Preview** to verify the tenant route, then choose **Publish** when it is ready.

Pages are tenant-scoped by CMS access controls. A page created for `demo1` must not be readable or writable through another tenant's route.

## Update Seed Fixtures

`apps/cms/src/fixtures/v1.json` is the versioned source of truth for deterministic seed content. The normal `npm run seed` command imports that fixture non-destructively: it creates missing tenants/pages and skips changed records. To intentionally overwrite changed CMS records, use `npm run seed --force`.

To bring intentional CMS changes back into the fixture:

```sh
npm run seed:export -- /tmp/site-fixture.json
cp /tmp/site-fixture.json apps/cms/src/fixtures/v1.json
npm run format
git diff -- apps/cms/src/fixtures/v1.json
```

Review the diff before committing. Export removes generated IDs and timestamps and replaces media relationships with filename references. Import the reviewed fixture with `npm run seed:import -- apps/cms/src/fixtures/v1.json`; use `--force` only when replacing editor changes is intentional.
