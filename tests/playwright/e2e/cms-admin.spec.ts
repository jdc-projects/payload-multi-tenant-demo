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

test("Northstar services opens its tenant and slug in live preview", async ({
  page,
}) => {
  const login = await page.request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const response = await page.request.get(
    `/api/pages?where=${encodeURIComponent(
      JSON.stringify({
        and: [
          { "tenant.slug": { equals: "demo2" } },
          { slug: { equals: "services" } },
        ],
      }),
    )}`,
  );
  expect(response.ok()).toBe(true);
  const pageRecord = (await response.json()).docs[0] as { id: string | number };
  await page.goto(`/admin/collections/pages/${pageRecord.id}`);
  await page.getByRole("button", { name: /live preview/i }).click();
  const iframe = page.locator("iframe").last();
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute(
    "src",
    /\/demo2\/services\?preview=true/,
  );
  const preview = page.frameLocator("#live-preview-iframe");
  await expect(
    preview.getByRole("heading", { name: "Clear direction for complex work" }),
  ).toBeVisible();
  const image = preview.getByRole("img", {
    name: "Clear direction for complex work",
  });
  await expect(image).toBeVisible();
  const imageSrc = await image.getAttribute("src");
  expect(imageSrc).toMatch(/\/media\/studio-mark\.svg$/);
  const imageResponse = await page.request.get(imageSrc!);
  expect(imageResponse.ok()).toBe(true);
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      "#live-preview-iframe",
    );
    iframe?.contentWindow?.postMessage(
      {
        type: "payload-live-preview",
        data: {
          id: "different-page",
          layout: [
            {
              blockType: "hero",
              heading: "Welcome to Northstar",
              body: "Stale document data",
            },
          ],
        },
      },
      "*",
    );
  });
  await expect(
    preview.getByRole("heading", { name: "Clear direction for complex work" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /live preview/i }).click();
  await expect(iframe).not.toBeVisible();
});

test("standalone live preview accepts updates from the Payload popup", async ({
  page,
}) => {
  const login = await page.request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const response = await page.request.get(
    `/api/pages?where=${encodeURIComponent(
      JSON.stringify({
        and: [
          { "tenant.slug": { equals: "demo2" } },
          { slug: { equals: "services" } },
        ],
      }),
    )}&depth=2`,
  );
  expect(response.ok()).toBe(true);
  const pageRecord = (await response.json()).docs[0] as {
    id: string | number;
    layout: Array<Record<string, unknown>>;
  };
  await page.goto(`/admin/collections/pages/${pageRecord.id}`);
  await page.getByRole("button", { name: /live preview/i }).click();
  await expect(page.locator("iframe").last()).toBeVisible();

  const openPreview = page.getByTitle(/open in new window/i);
  const popupPromise = page.waitForEvent("popup");
  await openPreview.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(
    popup.getByRole("heading", { name: "Clear direction for complex work" }),
  ).toBeVisible();

  const heroIndex = pageRecord.layout.findIndex(
    (block) => block.blockType === "hero",
  );
  expect(heroIndex).toBeGreaterThanOrEqual(0);
  const popupName = "payload-preview-regression";
  await popup.evaluate((name) => {
    window.name = name;
  }, popupName);
  const postPreviewUpdate = (layout: Array<Record<string, unknown>>) =>
    page.evaluate(
      ({ id, layout, popupName }) => {
        const popup = window.open("", popupName);
        if (!popup) throw new Error("Could not access preview popup");
        popup.postMessage(
          {
            type: "payload-live-preview",
            data: { id, layout },
          },
          window.location.origin,
        );
      },
      { id: pageRecord.id, layout, popupName },
    );

  const headingLayout = pageRecord.layout.map((block, index) =>
    index === heroIndex
      ? { ...block, heading: "Popup update received" }
      : block,
  );
  await postPreviewUpdate(headingLayout);
  await expect(
    popup.getByRole("heading", { name: "Popup update received" }),
  ).toBeVisible();

  const popupFrame = popup.locator('div[style*="aspect-ratio"]').first();
  const fullWidth = await popupFrame.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const narrowLayout = pageRecord.layout.map((block, index) =>
    index === heroIndex ? { ...block, mediaSize: "narrow" } : block,
  );
  await postPreviewUpdate(narrowLayout);
  await expect
    .poll(() =>
      popupFrame.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeLessThan(fullWidth);
  await popup.close();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await page.getByRole("button", { name: /live preview/i }).click();
  await expect(page.locator("#live-preview-iframe")).not.toBeVisible();
});

test("Acme About preview loads its image block", async ({ page }) => {
  const login = await page.request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const response = await page.request.get(
    `/api/pages?where=${encodeURIComponent(
      JSON.stringify({
        and: [
          { "tenant.slug": { equals: "demo1" } },
          { slug: { equals: "about" } },
        ],
      }),
    )}`,
  );
  expect(response.ok()).toBe(true);
  const pageRecord = (await response.json()).docs[0] as { id: string | number };
  await page.goto(`/admin/collections/pages/${pageRecord.id}`);
  await page.getByRole("button", { name: /live preview/i }).click();
  const preview = page.frameLocator("#live-preview-iframe");
  await expect(
    preview.getByRole("heading", {
      name: "A small studio with a broad brief",
    }),
  ).toBeVisible({ timeout: 30_000 });
  const image = preview.getByRole("img", { name: "Abstract studio landscape" });
  await expect(image).toBeVisible();
  const imageSrc = await image.getAttribute("src");
  expect(imageSrc).toBeTruthy();
  expect(imageSrc).toMatch(/\/media\/studio-mark\.svg$/);
  const imageResponse = await page.request.get(imageSrc!);
  expect(imageResponse.ok()).toBe(true);
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("full-size media fills the shared content width", async ({ page }) => {
  const login = await page.request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const frameWidths: number[] = [];
  for (const path of ["/demo1/about", "/demo3/journal"]) {
    await page.goto(`${path}?preview=true`);
    const frame = page.locator('div[style*="aspect-ratio"]').first();
    await expect(frame).toBeVisible();
    const widths = await frame.evaluate((element) => {
      const container = element.closest(".mantine-Container-root");
      const styles = container ? getComputedStyle(container) : undefined;
      const horizontalPadding = styles
        ? parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
        : 0;
      return {
        frame: element.getBoundingClientRect().width,
        container:
          (container?.getBoundingClientRect().width ?? 0) - horizontalPadding,
      };
    });
    expect(widths.frame).toBeGreaterThan(0);
    expect(widths.frame).toBeCloseTo(widths.container, 0);
    frameWidths.push(widths.frame);
  }
  expect(frameWidths[0]).toBeGreaterThan(1000);
  expect(frameWidths[0]).toBeCloseTo(frameWidths[1] ?? 0, 0);
});
