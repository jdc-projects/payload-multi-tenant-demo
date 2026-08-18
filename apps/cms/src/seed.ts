import { loadRootEnv } from "../../../scripts/env.js";
import { getPayload } from "payload";
import {
  fixturePath,
  mediaRefs,
  normalize,
  readFixture,
  resolveMediaRefs,
  writeFixture,
  type SeedFixture,
} from "./seed-data.js";

loadRootEnv();
const { default: config } = await import("./payload.config.js");

export const tenants = [
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
async function exportFixture(output: string) {
  const payload = await getPayload({ config });
  const tenantResult = await payload.find({
    collection: "tenants",
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  const tenants = tenantResult.docs.map(
    (tenant) => normalize(tenant) as SeedFixture["tenants"][number],
  );
  const tenantById = new Map(
    tenantResult.docs.map((tenant) => [
      String(tenant.id),
      tenant.slug as string,
    ]),
  );
  const pageResult = await payload.find({
    collection: "pages",
    limit: 1000,
    depth: 2,
    overrideAccess: true,
  });
  const pages = pageResult.docs.map((page) => {
    const value = mediaRefs(normalize(page)) as Record<string, unknown>;
    const tenant = page.tenant as { id?: string; slug?: string } | string;
    value.tenant =
      typeof tenant === "string"
        ? (tenantById.get(tenant) ?? tenant)
        : tenant.slug;
    return value as SeedFixture["pages"][number];
  });
  const mediaResult = await payload.find({
    collection: "media",
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  const media = mediaResult.docs.map((item) =>
    Object.assign({}, normalize(item), { ref: String(item.filename) }),
  ) as SeedFixture["media"];
  await writeFixture(output, { version: 1, tenants, pages, media });
  console.log(
    `Exported ${tenants.length} tenants, ${pages.length} pages, ${media.length} media refs to ${output}`,
  );
  await payload.db.destroy?.();
}

async function importFixture(input: string, force: boolean) {
  const fixture = await readFixture(input);
  const payload = await getPayload({ config });
  const tenantIDs = new Map<string, string>();
  const mediaIDs = new Map<string, string>();
  let skipped = 0;
  for (const tenant of fixture.tenants) {
    const existing = await payload.find({
      collection: "tenants",
      where: { slug: { equals: tenant.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (existing.docs[0]) {
      tenantIDs.set(tenant.slug, String(existing.docs[0].id));
      if (force)
        await payload.update({
          collection: "tenants",
          id: existing.docs[0].id,
          data: tenant,
          overrideAccess: true,
        });
      else if (
        JSON.stringify(normalize(existing.docs[0])) !==
        JSON.stringify(normalize(tenant))
      ) {
        skipped++;
        console.warn(
          `Skipped changed tenant ${tenant.slug}; use --force to overwrite`,
        );
      }
    } else {
      const created = await payload.create({
        collection: "tenants",
        data: tenant,
        overrideAccess: true,
      });
      tenantIDs.set(tenant.slug, String(created.id));
    }
  }
  for (const media of fixture.media) {
    const existing = await payload.find({
      collection: "media",
      where: { filename: { equals: media.ref } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (existing.docs[0]) mediaIDs.set(media.ref, String(existing.docs[0].id));
    else
      console.warn(
        `Media ref ${media.ref} is not present; upload it before importing pages`,
      );
  }
  for (const page of fixture.pages) {
    const slug = String(page.slug ?? "");
    const tenantSlug = page.tenant;
    const tenant = tenantIDs.get(tenantSlug);
    if (!tenant)
      throw new Error(`Fixture page references unknown tenant ${tenantSlug}`);
    const data = {
      ...page,
      tenant,
      layout: resolveMediaRefs(page.layout, mediaIDs),
    };
    const existing = await payload.find({
      collection: "pages",
      where: {
        and: [{ tenant: { equals: tenant } }, { slug: { equals: slug } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (existing.docs[0]) {
      if (force)
        await payload.update({
          collection: "pages",
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        });
      else if (
        JSON.stringify(normalize(existing.docs[0])) !==
        JSON.stringify(normalize(data))
      ) {
        skipped++;
        console.warn(
          `Skipped changed page ${tenantSlug}/${slug}; use --force to overwrite`,
        );
      }
    } else
      await payload.create({ collection: "pages", data, overrideAccess: true });
  }
  console.log(`Imported fixture (skipped ${skipped} changed records)`);
  await payload.db.destroy?.();
}

async function seed() {
  const payload = await getPayload({ config });
  for (const tenant of tenants) {
    const existing = await payload.find({
      collection: "tenants",
      where: { slug: { equals: tenant.slug } },
      limit: 1,
      overrideAccess: true,
    });
    const record =
      existing.docs[0] ??
      (await payload.create({
        collection: "tenants",
        data: tenant,
        overrideAccess: true,
      }));
    const page = await payload.find({
      collection: "pages",
      where: {
        and: [{ tenant: { equals: record.id } }, { slug: { equals: "" } }],
      },
      limit: 1,
      overrideAccess: true,
    });
    if (!page.docs[0])
      await payload.create({
        collection: "pages",
        data: {
          title: tenant.name,
          slug: "",
          _status: "published",
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
        overrideAccess: true,
      });
  }
  console.log(`Seeded ${tenants.length} tenants`);
}

const [command, argument, ...flags] = process.argv.slice(2);
const operation =
  command === "export" || command === "import" ? command : "seed";
const file =
  argument ?? (operation === "export" ? fixturePath() : fixturePath());
const run =
  operation === "export"
    ? exportFixture(file)
    : operation === "import"
      ? importFixture(file, flags.includes("--force"))
      : seed();
void run
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
