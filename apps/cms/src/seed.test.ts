import { describe, expect, it } from "vitest";
import { fixturePath } from "./seed-data.js";
import { importFixture } from "./seed.js";

type RecordValue = { id: string | number; [key: string]: unknown };

function createPayloadStub() {
  const records: Record<string, RecordValue[]> = {
    tenants: [],
    media: [],
    pages: [],
  };
  const creates: string[] = [];
  let nextID = 1;

  const payload = {
    db: {
      beginTransaction: async () => "seed-test-transaction",
      commitTransaction: async () => undefined,
      rollbackTransaction: async () => undefined,
    },
    find: async ({ collection, where }: Record<string, any>) => {
      const collectionRecords = records[collection] ?? [];
      if (collection === "tenants") {
        const slug = where?.slug?.equals;
        return {
          docs: collectionRecords.filter((record) => record.slug === slug),
        };
      }
      if (collection === "media") {
        const filename = where?.filename?.equals;
        return {
          docs: collectionRecords.filter(
            (record) => record.filename === filename,
          ),
        };
      }
      const [tenantCondition, slugCondition] = where?.and ?? [];
      return {
        docs: collectionRecords.filter(
          (record) =>
            record.tenant === tenantCondition?.tenant?.equals &&
            record.slug === slugCondition?.slug?.equals,
        ),
      };
    },
    create: async ({ collection, data, file }: Record<string, any>) => {
      const record = {
        ...(data ?? {}),
        ...(file ? { filename: file.name } : {}),
        id: `seed-test-${nextID++}`,
      };
      records[collection]?.push(record);
      creates.push(collection);
      return record;
    },
  };

  return { payload, records, creates };
}

describe("fixture media seeding", () => {
  it("reuses media and records on a second import", async () => {
    const fixture = fixturePath();
    const stub = createPayloadStub();

    await importFixture(fixture, false, stub.payload as any);
    const firstCounts = Object.fromEntries(
      Object.entries(stub.records).map(([collection, records]) => [
        collection,
        records.length,
      ]),
    );
    const firstCreates = stub.creates.length;

    await importFixture(fixture, false, stub.payload as any);

    expect(stub.creates.length).toBe(firstCreates);
    expect(
      Object.fromEntries(
        Object.entries(stub.records).map(([collection, records]) => [
          collection,
          records.length,
        ]),
      ),
    ).toEqual(firstCounts);
  });
});
