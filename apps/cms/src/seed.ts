import config from "./payload.config";
import { getPayload } from "payload";

const tenants = [
  {
    name: "Acme Studio",
    slug: "demo1",
    theme: { primaryColor: "#5b21b6", fontFamily: "Inter" },
  },
  {
    name: "Northstar",
    slug: "demo2",
    theme: { primaryColor: "#0f766e", fontFamily: "Georgia" },
  },
  {
    name: "Field Notes",
    slug: "demo3",
    theme: { primaryColor: "#c2410c", fontFamily: "system-ui" },
  },
];
async function seed() {
  const payload = await getPayload({ config });
  for (const tenant of tenants) {
    const existing = await payload.find({
      collection: "tenants",
      where: { slug: { equals: tenant.slug } },
      limit: 1,
    });
    const record =
      existing.docs[0] ??
      (await payload.create({ collection: "tenants", data: tenant }));
    const page = await payload.find({
      collection: "pages",
      where: {
        and: [{ tenant: { equals: record.id } }, { slug: { equals: "" } }],
      },
      limit: 1,
    });
    if (!page.docs[0])
      await payload.create({
        collection: "pages",
        data: {
          title: tenant.name,
          slug: "",
          tenant: record.id,
          layout: [
            {
              blockType: "hero",
              heading: `Welcome to ${tenant.name}`,
              body: "A Payload-powered site assembled from code-defined components.",
              actions: [{ label: "Explore", href: "#" }],
              spacing: "lg",
            },
            {
              blockType: "featureGrid",
              heading: "Built for flexible content",
              features: [
                {
                  title: "Composable",
                  body: "Editors arrange approved components into a page.",
                },
                {
                  title: "Tenant-aware",
                  body: "Each tenant owns its content and visual theme.",
                },
              ],
              spacing: "md",
            },
          ],
        },
      });
  }
  console.log(`Seeded ${tenants.length} tenants`);
}

void seed();
