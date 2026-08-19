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
