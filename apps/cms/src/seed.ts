import { loadRootEnv } from "../../../scripts/env.js";
import { getPayload } from "payload";
import {
  fixturePath,
  collectMediaRefs,
  mediaRefs,
  normalize,
  readAllPages,
  recordsChanged,
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
  const tenantDocs = await readAllPages((page) =>
    payload.find({
      collection: "tenants",
      limit: 1000,
      page,
      depth: 0,
      overrideAccess: true,
    }),
  );
  const tenants = tenantDocs.map(
    (tenant) => normalize(tenant) as SeedFixture["tenants"][number],
  );
  const tenantById = new Map(
    tenantDocs.map((tenant) => [String(tenant.id), tenant.slug as string]),
  );
  const pageDocs = await readAllPages((page) =>
    payload.find({
      collection: "pages",
      limit: 1000,
      page,
      depth: 2,
      overrideAccess: true,
    }),
  );
  const pages = pageDocs.map((page) => {
    const value = mediaRefs(normalize(page)) as Record<string, unknown>;
    const tenant = page.tenant as { id?: string; slug?: string } | string;
    value.tenant =
      typeof tenant === "string"
        ? (tenantById.get(tenant) ?? tenant)
        : tenant.slug;
    return value as SeedFixture["pages"][number];
  });
  const mediaDocs = await readAllPages((page) =>
    payload.find({
      collection: "media",
      limit: 1000,
      page,
      depth: 0,
      overrideAccess: true,
    }),
  );
  const media = mediaDocs.map((item) =>
    Object.assign({}, normalize(item), { ref: String(item.filename) }),
  ) as SeedFixture["media"];
  await writeFixture(output, { version: 1, tenants, pages, media });
  console.log(
    `Exported ${tenants.length} tenants, ${pages.length} pages, ${media.length} media refs to ${output}`,
  );
  await payload.db.destroy?.();
}

type PayloadClient = Awaited<ReturnType<typeof getPayload>>;

async function importTenant(
  payload: PayloadClient,
  tenant: SeedFixture["tenants"][number],
  force: boolean,
  tenantIDs: Map<string, string>,
  transactionID?: string | number,
) {
  const existing = await payload.find({
    collection: "tenants",
    where: { slug: { equals: tenant.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const record = existing.docs[0];
  if (!record) {
    const created = await payload.create({
      collection: "tenants",
      data: tenant,
      overrideAccess: true,
      req: { transactionID },
    });
    tenantIDs.set(tenant.slug, String(created.id));
    return false;
  }
  tenantIDs.set(tenant.slug, String(record.id));
  if (force) {
    await payload.update({
      collection: "tenants",
      id: record.id,
      data: tenant,
      overrideAccess: true,
      req: { transactionID },
    });
    return false;
  }
  const changed = recordsChanged(record, tenant);
  if (changed) {
    console.warn(
      `Skipped changed tenant ${tenant.slug}; use --force to overwrite`,
    );
  }
  return changed;
}

async function importMedia(
  payload: PayloadClient,
  media: SeedFixture["media"][number],
  mediaIDs: Map<string, string>,
): Promise<boolean> {
  const existing = await payload.find({
    collection: "media",
    where: { filename: { equals: media.ref } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const record = existing.docs[0];
  if (record) {
    mediaIDs.set(media.ref, String(record.id));
    return true;
  }
  console.warn(
    `Media ref ${media.ref} is not present; upload it before importing pages`,
  );
  return false;
}

async function importPage(
  payload: PayloadClient,
  page: SeedFixture["pages"][number],
  force: boolean,
  tenantIDs: Map<string, string>,
  mediaIDs: Map<string, string>,
  transactionID?: string | number,
) {
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
  const record = existing.docs[0];
  if (!record) {
    await payload.create({
      collection: "pages",
      data,
      overrideAccess: true,
      req: { transactionID },
    });
    return false;
  }
  if (force) {
    await payload.update({
      collection: "pages",
      id: record.id,
      data,
      overrideAccess: true,
      req: { transactionID },
    });
    return false;
  }
  const changed = recordsChanged(record, data);
  if (changed) {
    console.warn(
      `Skipped changed page ${tenantSlug}/${slug}; use --force to overwrite`,
    );
  }
  return changed;
}

async function prepareMedia(
  payload: PayloadClient,
  fixture: SeedFixture,
): Promise<{ mediaIDs: Map<string, string>; missingMedia: Set<string> }> {
  const mediaIDs = new Map<string, string>();
  const missingMedia = new Set<string>();
  for (const media of fixture.media) {
    if (!(await importMedia(payload, media, mediaIDs)))
      missingMedia.add(media.ref);
  }
  for (const page of fixture.pages) {
    for (const ref of collectMediaRefs(page.layout))
      if (!mediaIDs.has(ref)) missingMedia.add(ref);
  }
  return { mediaIDs, missingMedia };
}

async function importTenants(
  payload: PayloadClient,
  fixture: SeedFixture,
  force: boolean,
  tenantIDs: Map<string, string>,
  transactionID?: string | number,
) {
  let skipped = 0;
  for (const tenant of fixture.tenants)
    skipped += Number(
      await importTenant(payload, tenant, force, tenantIDs, transactionID),
    );
  return skipped;
}

async function importPages(
  payload: PayloadClient,
  fixture: SeedFixture,
  force: boolean,
  tenantIDs: Map<string, string>,
  mediaIDs: Map<string, string>,
  transactionID?: string | number,
) {
  let skipped = 0;
  for (const page of fixture.pages)
    skipped += Number(
      await importPage(
        payload,
        page,
        force,
        tenantIDs,
        mediaIDs,
        transactionID,
      ),
    );
  return skipped;
}

async function importFixture(input: string, force: boolean) {
  const fixture = await readFixture(input);
  const payload = await getPayload({ config });
  const tenantIDs = new Map<string, string>();
  try {
    const knownTenants = new Set(fixture.tenants.map(({ slug }) => slug));
    const unknownTenant = fixture.pages.find(
      (page) => !knownTenants.has(page.tenant),
    );
    if (unknownTenant)
      throw new Error(
        `Fixture page references unknown tenant ${unknownTenant.tenant}`,
      );
    const { mediaIDs, missingMedia } = await prepareMedia(payload, fixture);
    if (missingMedia.size)
      throw new Error(
        `Cannot import fixture: missing media (${[...missingMedia].join(", ")}); no records were written`,
      );

    // Payload's database transaction is shared by every local API operation.
    // This prevents a validation or adapter error halfway through the fixture
    // from leaving tenants/pages written without the rest of the fixture.
    const db = payload.db as typeof payload.db & {
      beginTransaction?: () => Promise<string | number | null>;
      commitTransaction?: (id: string | number) => Promise<void>;
      rollbackTransaction?: (id: string | number) => Promise<void>;
    };
    if (
      !db.beginTransaction ||
      !db.commitTransaction ||
      !db.rollbackTransaction
    )
      throw new Error("Payload database does not support fixture transactions");
    const transactionID = await db.beginTransaction();
    if (transactionID === null)
      throw new Error("Payload failed to start fixture transaction");
    try {
      const skipped =
        (await importTenants(
          payload,
          fixture,
          force,
          tenantIDs,
          transactionID,
        )) +
        (await importPages(
          payload,
          fixture,
          force,
          tenantIDs,
          mediaIDs,
          transactionID,
        ));
      await db.commitTransaction(transactionID);
      console.log(`Imported fixture (skipped ${skipped} changed records)`);
    } catch (error) {
      await db.rollbackTransaction(transactionID).catch(() => undefined);
      throw error;
    }
  } finally {
    await payload.db.destroy?.();
  }
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
