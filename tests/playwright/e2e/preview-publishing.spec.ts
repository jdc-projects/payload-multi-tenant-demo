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
