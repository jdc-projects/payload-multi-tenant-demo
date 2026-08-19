import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importFixture } from "./seed.js";

type Doc = Record<string, any>;
type MockPayload = NonNullable<Parameters<typeof importFixture>[2]>;

async function fixtureFile(fixture: Record<string, unknown>) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "seed-import-"));
  const file = path.join(directory, "fixture.json");
  await fs.writeFile(
    file,
    JSON.stringify({ version: 1, media: [], ...fixture }),
  );
  return file;
}

function payloadMock(
  options: { failOnPage?: number; rollbackFails?: boolean } = {},
) {
  const docs: Record<string, Doc[]> = { tenants: [], pages: [], media: [] };
  let transactionDocs: Record<string, Doc[]> | undefined;
  let transactionSnapshot: Record<string, Doc[]> | undefined;
  let nextID = 1;
  let transactionID = 0;
  const findTransactionIDs: Array<string | number | undefined> = [];
  const payload = {
    db: {
      beginTransaction: async () => {
        transactionID += 1;
        transactionSnapshot = structuredClone(docs);
        transactionDocs = structuredClone(docs);
        return transactionID;
      },
      commitTransaction: async () => {
        for (const collection of Object.keys(docs))
          docs[collection] = transactionDocs?.[collection] ?? [];
        transactionDocs = undefined;
      },
      rollbackTransaction: async () => {
        if (options.rollbackFails) throw new Error("rollback outage");
        for (const collection of Object.keys(docs))
          docs[collection] = transactionSnapshot?.[collection] ?? [];
        transactionSnapshot = undefined;
        transactionDocs = undefined;
      },
    },
    find: async ({ collection, where, req }: any) => {
      findTransactionIDs.push(req?.transactionID);
      const source = transactionDocs?.[collection] ?? docs[collection];
      const terms =
        where?.and ??
        Object.entries(where ?? {}).map(([field, value]) => ({
          [field]: value,
        }));
      const result = source.filter((doc) =>
        terms.every((term: any) => {
          const [field, condition] = Object.entries(term)[0] as [string, any];
          return doc[field] === condition.equals;
        }),
      );
      return { docs: result.slice(0, 1) };
    },
    create: async ({ collection, data, req }: any) => {
      if (
        options.failOnPage &&
        collection === "pages" &&
        data.slug === `page-${options.failOnPage}`
      )
        throw new Error("mid-fixture failure");
      const record = { ...data, id: String(nextID++) };
      transactionDocs?.[collection].push(record);
      return record;
    },
    update: async () => undefined,
  } as unknown as MockPayload;
  return { payload, docs, findTransactionIDs };
}

const tenant = { name: "Tenant", slug: "demo1" };
const page = (slug: string) => ({
  title: slug,
  slug,
  tenant: "demo1",
  layout: [],
});

describe("fixture import transactions", () => {
  it("propagates the transaction and rolls back a mid-fixture failure", async () => {
    const file = await fixtureFile({
      tenants: [tenant],
      pages: [page("page-1"), page("page-2")],
    });
    const { payload, docs, findTransactionIDs } = payloadMock({
      failOnPage: 2,
    });

    await expect(importFixture(file, false, payload)).rejects.toThrow(
      "mid-fixture failure",
    );
    expect(docs.tenants).toEqual([]);
    expect(docs.pages).toEqual([]);
    expect(findTransactionIDs.every((id) => id === 1)).toBe(true);
  });

  it("observes duplicate fixture entries in one transaction and is idempotent", async () => {
    const file = await fixtureFile({
      tenants: [tenant, tenant],
      pages: [page("home"), page("home")],
    });
    const first = payloadMock();
    await importFixture(file, false, first.payload);
    expect(first.docs.tenants).toHaveLength(1);
    expect(first.docs.pages).toHaveLength(1);

    const second = payloadMock();
    second.docs.tenants.push(...first.docs.tenants);
    second.docs.pages.push(...first.docs.pages);
    await importFixture(file, false, second.payload);
    expect(second.docs.tenants).toHaveLength(1);
    expect(second.docs.pages).toHaveLength(1);
  });

  it("reports rollback failure while preserving the import error as cause", async () => {
    const file = await fixtureFile({
      tenants: [tenant],
      pages: [page("page-1")],
    });
    const { payload } = payloadMock({ failOnPage: 1, rollbackFails: true });

    await expect(importFixture(file, false, payload)).rejects.toMatchObject({
      message: expect.stringContaining("rollback failed: rollback outage"),
      cause: expect.objectContaining({ message: "mid-fixture failure" }),
    });
  });
});
