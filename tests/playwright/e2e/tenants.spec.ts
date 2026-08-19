import { expect, test } from "@playwright/test";

test("each tenant has an independently addressable home page", async ({
  page,
}) => {
  for (const tenant of ["demo1", "demo2", "demo3"]) {
    await page.goto(`/${tenant}/`);
    await expect(page).toHaveURL(new RegExp(`/${tenant}/$`));
  }
});

test("editors can create tenant-scoped pages with approved blocks", async ({
  request,
}) => {
  const login = await request.post("/api/users/login", {
    data: {
      email: process.env.PAYLOAD_ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.PAYLOAD_ADMIN_PASSWORD ?? "changemechangeme",
    },
  });
  expect(login.ok()).toBe(true);

  const tenantsResponse = await request.get("/api/tenants?limit=100");
  expect(tenantsResponse.ok()).toBe(true);
  const tenants = (await tenantsResponse.json()) as {
    docs: Array<{ id: string; slug: string }>;
  };
  const created: string[] = [];
  const createdPages: Array<{ tenant: string; slug: string; heading: string }> =
    [];
  const suffix = Date.now().toString(36);
  try {
    for (const tenant of tenants.docs.filter(({ slug }) =>
      ["demo1", "demo2", "demo3"].includes(slug),
    )) {
      const slug = `editor-page-${suffix}`;
      const response = await request.post("/api/pages", {
        data: {
          title: `${tenant.slug} editor page`,
          slug,
          _status: "published",
          tenant: tenant.id,
          layout: [
            {
              blockType: "hero",
              heading: `${tenant.slug} custom page`,
              body: "Created through the CMS page API.",
              spacing: "md",
            },
            {
              blockType: "callToAction",
              heading: "A reusable section",
              label: "Learn more",
              href: "/",
              spacing: "sm",
            },
          ],
        },
      });
      expect(response.ok()).toBe(true);
      const page = (await response.json()) as {
        doc: { id: string | number };
      };
      created.push(String(page.doc.id));
      createdPages.push({
        tenant: tenant.slug,
        slug,
        heading: `${tenant.slug} custom page`,
      });
    }

    for (const createdPage of createdPages) {
      await expect
        .poll(async () =>
          (
            await request.get(`/${createdPage.tenant}/${createdPage.slug}/`)
          ).status(),
        )
        .toBe(200);
      const publicPage = await request.get(
        `/${createdPage.tenant}/${createdPage.slug}/`,
      );
      expect(await publicPage.text()).toContain(createdPage.heading);
      const otherTenant = ["demo1", "demo2", "demo3"].find(
        (slugValue) => slugValue !== createdPage.tenant,
      );
      const otherTenantPage = await request.get(
        `/${otherTenant}/${createdPage.slug}/`,
      );
      expect(await otherTenantPage.text()).not.toContain(createdPage.heading);
    }
    expect(created).toHaveLength(3);
  } finally {
    await Promise.all(
      created.map(async (id) => {
        const response = await request.delete(`/api/pages/${id}`);
        expect(response.ok()).toBe(true);
      }),
    );
  }
});
