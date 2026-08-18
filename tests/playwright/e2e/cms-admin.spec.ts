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
});
