import { expect, test } from "@playwright/test";

test("each tenant has an independently addressable home page", async ({
  page,
}) => {
  for (const tenant of ["demo1", "demo2", "demo3"]) {
    await page.goto(`/${tenant}/`);
    await expect(page).toHaveURL(new RegExp(`/${tenant}/$`));
  }
});
