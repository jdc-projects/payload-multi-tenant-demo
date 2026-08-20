import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("web home page renders and meets WCAG AA checks", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Payload multi-tenant demo/i }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("tenant pages preserve hierarchy, links, and responsive layout", async ({
  page,
}) => {
  await page.goto("/demo1/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "About Acme Studio" }).first(),
  ).toHaveAttribute("href", "/demo1/about/");
  await expect(page.getByRole("link", { name: "Explore" })).toHaveAttribute(
    "href",
    "#",
  );

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "About Acme Studio" }),
  ).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("tenant hero media loads from the CMS", async ({ page }) => {
  await page.goto("/demo2/services/");
  await expect(
    page.getByRole("heading", { name: "Clear direction for complex work" }),
  ).toBeVisible();
  const image = page.getByRole("img", {
    name: "Clear direction for complex work",
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("live preview applies incoming unsaved layout changes", async ({
  page,
}) => {
  await page.goto("/");
  const pageResponse = await page.request.get(
    `/api/pages?where=${encodeURIComponent(
      JSON.stringify({
        and: [{ "tenant.slug": { equals: "demo1" } }, { slug: { equals: "" } }],
      }),
    )}&depth=0`,
    { headers: { "x-cms-renderer-token": process.env.CMS_RENDERER_TOKEN! } },
  );
  expect(pageResponse.ok()).toBe(true);
  const pageRecord = (await pageResponse.json()).docs[0] as {
    id: string | number;
  };
  await page.evaluate(
    (src) =>
      new Promise<void>((resolve, reject) => {
        const iframe = document.createElement("iframe");
        const timeout = window.setTimeout(
          () => reject(new Error("Preview iframe did not become ready")),
          10_000,
        );
        const handleMessage = (event: MessageEvent) => {
          if (
            event.source === iframe.contentWindow &&
            event.data?.type === "payload-live-preview" &&
            event.data.ready
          ) {
            window.clearTimeout(timeout);
            window.removeEventListener("message", handleMessage);
            resolve();
          }
        };
        window.addEventListener("message", handleMessage);
        iframe.id = "live-preview-test-iframe";
        iframe.src = src;
        document.body.append(iframe);
      }),
    "/demo1/",
  );
  const iframe = page.locator("#live-preview-test-iframe");
  await expect(
    iframe.contentFrame().getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await page.evaluate(
    ({ id }) => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        "#live-preview-test-iframe",
      );
      iframe?.contentWindow?.postMessage(
        {
          type: "payload-live-preview",
          data: {
            id,
            layout: [
              {
                blockType: "hero",
                heading: "Unsaved preview title",
                body: "This change has not been saved.",
              },
            ],
          },
        },
        window.location.origin,
      );
    },
    { id: pageRecord.id },
  );
  await expect(
    iframe
      .contentFrame()
      .getByRole("heading", { name: "Unsaved preview title" }),
  ).toBeVisible();
});
