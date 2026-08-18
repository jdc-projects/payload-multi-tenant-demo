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
