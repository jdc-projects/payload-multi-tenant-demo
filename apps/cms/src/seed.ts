import { loadRootEnv } from "../../../scripts/env.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

async function payloadConfig() {
  return (await import("./payload.config.js")).default;
}

async function exportFixture(output: string) {
  const payload = await getPayload({ config: await payloadConfig() });
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
type TransactionID = string | number;
type TransactionDatabase = PayloadClient["db"] & {
  beginTransaction?: () => Promise<TransactionID | null>;
  commitTransaction?: (id: TransactionID) => Promise<void>;
  rollbackTransaction?: (id: TransactionID) => Promise<void>;
};

const transactionMethods = [
  "beginTransaction",
  "commitTransaction",
  "rollbackTransaction",
] as const;

function getTransactionDatabase(payload: PayloadClient): TransactionDatabase {
  const db = payload.db as TransactionDatabase;
  if (transactionMethods.some((method) => !db[method]))
    throw new Error("Payload database does not support fixture transactions");
  return db;
}

function validateFixtureTenants(fixture: SeedFixture) {
  const knownTenants = new Set(fixture.tenants.map(({ slug }) => slug));
  const unknownTenant = fixture.pages.find(
    (page) => !knownTenants.has(page.tenant),
  );
  if (unknownTenant)
    throw new Error(
      `Fixture page references unknown tenant ${unknownTenant.tenant}`,
    );
}

async function rollbackFixture(
  db: TransactionDatabase,
  transactionID: TransactionID,
  error: unknown,
): Promise<never> {
  try {
    await db.rollbackTransaction!(transactionID);
  } catch (rollbackError) {
    const originalMessage =
      error instanceof Error ? error.message : String(error);
    const rollbackMessage =
      rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
    throw new Error(
      `Fixture import failed: ${originalMessage}; rollback failed: ${rollbackMessage}`,
      { cause: error },
    );
  }
  throw error;
}

async function runFixtureTransaction(
  db: TransactionDatabase,
  operation: (transactionID: TransactionID) => Promise<void>,
) {
  const transactionID = await db.beginTransaction!();
  if (transactionID === null)
    throw new Error("Payload failed to start fixture transaction");
  try {
    await operation(transactionID);
    await db.commitTransaction!(transactionID);
  } catch (error) {
    await rollbackFixture(db, transactionID, error);
  }
}

async function importFixtureRecords(
  payload: PayloadClient,
  fixture: SeedFixture,
  force: boolean,
  tenantIDs: Map<string, string | number>,
  transactionID: TransactionID,
) {
  const { mediaIDs, missingMedia } = await prepareMedia(
    payload,
    fixture,
    transactionID,
  );
  if (missingMedia.size)
    throw new Error(
      `Cannot import fixture: missing media (${[...missingMedia].join(", ")}); no records were written`,
    );
  const skipped =
    (await importTenants(payload, fixture, force, tenantIDs, transactionID)) +
    (await importPages(
      payload,
      fixture,
      force,
      tenantIDs,
      mediaIDs,
      transactionID,
    ));
  console.log(`Imported fixture (skipped ${skipped} changed records)`);
}

async function importTenant(
  payload: PayloadClient,
  tenant: SeedFixture["tenants"][number],
  force: boolean,
  tenantIDs: Map<string, string | number>,
  transactionID?: string | number,
) {
  const existing = await payload.find({
    collection: "tenants",
    where: { slug: { equals: tenant.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req: { transactionID },
  });
  const record = existing.docs[0];
  if (!record) {
    const created = await payload.create({
      collection: "tenants",
      data: tenant,
      overrideAccess: true,
      req: { transactionID },
    });
    tenantIDs.set(tenant.slug, created.id);
    return false;
  }
  tenantIDs.set(tenant.slug, record.id);
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
  mediaIDs: Map<string, string | number>,
  transactionID: string | number,
): Promise<boolean> {
  const existing = await payload.find({
    collection: "media",
    where: { filename: { equals: media.ref } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req: { transactionID },
  });
  const record = existing.docs[0];
  if (record) {
    mediaIDs.set(media.ref, record.id);
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
  tenantIDs: Map<string, string | number>,
  mediaIDs: Map<string, string | number>,
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
    req: { transactionID },
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
  transactionID: string | number,
): Promise<{
  mediaIDs: Map<string, string | number>;
  missingMedia: Set<string>;
}> {
  const mediaIDs = new Map<string, string | number>();
  const missingMedia = new Set<string>();
  for (const media of fixture.media) {
    if (!(await importMedia(payload, media, mediaIDs, transactionID)))
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
  tenantIDs: Map<string, string | number>,
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
  tenantIDs: Map<string, string | number>,
  mediaIDs: Map<string, string | number>,
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

export async function importFixture(
  input: string,
  force: boolean,
  providedPayload?: PayloadClient,
) {
  const fixture = await readFixture(input);
  const payload =
    providedPayload ?? (await getPayload({ config: await payloadConfig() }));
  const tenantIDs = new Map<string, string | number>();
  try {
    validateFixtureTenants(fixture);
    // Payload's database transaction is shared by every local API operation.
    // This prevents a validation or adapter error halfway through the fixture
    // from leaving tenants/pages written without the rest of the fixture.
    await runFixtureTransaction(
      getTransactionDatabase(payload),
      (transactionID) =>
        importFixtureRecords(payload, fixture, force, tenantIDs, transactionID),
    );
  } finally {
    if (!providedPayload) await payload.db.destroy?.();
  }
}

async function seedRecords(
  payload: PayloadClient,
  transactionID: TransactionID,
  force: boolean,
) {
  const fixture = await readFixture(fixturePath());
  validateFixtureTenants(fixture);
  await importFixtureRecords(
    payload,
    fixture,
    force,
    new Map<string, string | number>(),
    transactionID,
  );
  return fixture.tenants.length;
}

async function seed(force: boolean) {
  const payload = await getPayload({ config: await payloadConfig() });
  try {
    let tenantCount = 0;
    await runFixtureTransaction(
      getTransactionDatabase(payload),
      async (transactionID) => {
        tenantCount = await seedRecords(payload, transactionID, force);
      },
    );
    console.log(`Seeded ${tenantCount} tenants`);
  } finally {
    await payload.db.destroy?.();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const [command, argument, ...flags] = process.argv.slice(2);
  const operation =
    command === "export" || command === "import" ? command : "seed";
  const force =
    flags.includes("--force") || process.env.npm_config_force === "true";
  const file =
    argument ?? (operation === "export" ? fixturePath() : fixturePath());
  const run =
    operation === "export"
      ? exportFixture(file)
      : operation === "import"
        ? importFixture(file, force)
        : seed(force);
  void run
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
