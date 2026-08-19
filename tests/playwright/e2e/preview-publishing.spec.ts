import { expect, request as playwrightRequest, test } from "@playwright/test";

test("authenticated preview is tenant-scoped while visitors see published pages", async ({
  request,
}) => {
  const email = process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme";
  const editor = await playwrightRequest.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const login = await editor.post("/api/users/login", {
    data: { email, password },
  });
  expect(login.ok()).toBe(true);

  const pages = await editor.get(
    `/api/pages?depth=2&where=${encodeURIComponent(JSON.stringify({ and: [{ "tenant.slug": { equals: "demo1" } }, { slug: { equals: "" } }] }))}`,
  );
  expect(pages.ok()).toBe(true);
  const page = (
    (await pages.json()) as {
      docs: Array<{ id: string; layout: Array<Record<string, unknown>> }>;
    }
  ).docs[0];
  expect(page).toBeTruthy();
  const update = await editor.patch(`/api/pages/${page.id}?draft=true`, {
    data: {
      layout: page.layout.map((block, index) =>
        index === 0 ? { ...block, heading: "Preview-only title" } : block,
      ),
    },
  });
  expect(update.ok()).toBe(true);

  const preview = await editor.get(
    `/api/pages?draft=true&depth=1&where=${encodeURIComponent(JSON.stringify({ "tenant.slug": { equals: "demo1" } }))}`,
  );
  expect(preview.ok()).toBe(true);
  const previewData = (await preview.json()) as {
    docs: Array<{ _status?: string; tenant?: { slug?: string } }>;
  };
  expect(previewData.docs.every((page) => page.tenant?.slug === "demo1")).toBe(
    true,
  );
  const authenticatedPage = await editor.get("/demo1/?preview=true");
  expect(authenticatedPage.ok()).toBe(true);
  expect(await authenticatedPage.text()).toContain("Preview-only title");

  const visitor = await request.get(
    `/api/pages?draft=true&depth=1&where=${encodeURIComponent(JSON.stringify({ "tenant.slug": { equals: "demo1" } }))}`,
    { headers: { "x-cms-renderer-token": process.env.CMS_RENDERER_TOKEN! } },
  );
  expect(visitor.ok()).toBe(true);
  const visitorData = (await visitor.json()) as {
    docs: Array<{ _status?: string }>;
  };
  expect(visitorData.docs.every((page) => page._status === "published")).toBe(
    true,
  );
  const publicPage = await request.get("/demo1/?preview=true");
  expect(publicPage.ok()).toBe(true);
  expect(await publicPage.text()).not.toContain("Preview-only title");
  const publish = await editor.patch(`/api/pages/${page.id}?draft=false`, {
    data: { _status: "published" },
  });
  expect(publish.ok()).toBe(true);
  await editor.dispose();
});

test("revalidation is unavailable without the CMS secret", async ({
  request,
}) => {
  const response = await request.post("/api/revalidate", {
    data: { tenant: "demo1", slug: "" },
  });
  expect(response.status()).toBe(403);
});
