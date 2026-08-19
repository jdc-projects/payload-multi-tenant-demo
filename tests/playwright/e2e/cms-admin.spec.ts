import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("CMS admin assets load through the Caddy proxy", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.ok()).toBe(true);

  const assetUrls = await page
    .locator('script[src], link[rel="stylesheet"][href]')
    .evaluateAll((elements) =>
      elements
        .map((element) =>
          element instanceof HTMLScriptElement
            ? element.src
            : (element as HTMLLinkElement).href,
        )
        .filter((url) => url.includes("/_next/")),
    );
  expect(assetUrls.length).toBeGreaterThan(0);
  expect(
    assetUrls.every((url) => new URL(url).pathname.startsWith("/cms/")),
  ).toBe(true);
  for (const assetUrl of assetUrls) {
    const assetResponse = await page.request.get(assetUrl);
    expect(assetResponse.ok()).toBe(true);
  }
});

test("public page API access is not exposed", async ({ request }) => {
  const response = await request.get("/api/pages");
  expect(response.status()).toBe(403);
  const wrongToken = await request.get("/api/pages", {
    headers: { "x-cms-renderer-token": "wrong-token" },
  });
  expect(wrongToken.status()).toBe(403);
  const rendererResponse = await request.get("/api/pages", {
    headers: { "x-cms-renderer-token": process.env.CMS_RENDERER_TOKEN! },
  });
  expect(rendererResponse.ok()).toBe(true);
});

test("seeded Rich Text pages open in the CMS editor", async ({ page }) => {
  const login = await page.request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const pagesResponse = await page.request.get(
    `/api/pages?where=${encodeURIComponent(
      JSON.stringify({
        or: [{ slug: { equals: "about" } }, { slug: { equals: "journal" } }],
      }),
    )}&limit=10`,
  );
  expect(pagesResponse.ok()).toBe(true);
  const pages = (await pagesResponse.json()) as {
    docs: Array<{ id: string | number; slug: string }>;
  };
  expect(pages.docs.map(({ slug }) => slug).sort()).toEqual([
    "about",
    "journal",
  ]);

  for (const pageRecord of pages.docs) {
    await page.goto(`/admin/collections/pages/${pageRecord.id}`);
    await expect(page.getByText("Something went wrong:")).not.toBeVisible();
  }
});
