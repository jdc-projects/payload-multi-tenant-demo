import { describe, expect, it } from "vitest";
import {
  collectMediaRefs,
  fixturePath,
  normalize,
  readAllPages,
  readFixture,
  recordsChanged,
  writeFixture,
} from "./seed-data.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("seed fixtures", () => {
  it("loads the versioned fixture and keeps stable tenant/page references", async () => {
    const fixture = await readFixture(fixturePath());
    expect(fixture.version).toBe(1);
    expect(fixture.tenants.map(({ slug }) => slug)).toEqual([
      "demo1",
      "demo2",
      "demo3",
    ]);
    expect(fixture.pages.every((page) => typeof page.tenant === "string")).toBe(
      true,
    );
  });

  it("normalizes generated values recursively for clean round trips", () => {
    expect(
      normalize({
        id: "generated",
        createdAt: "now",
        nested: [{ id: "block", value: 1 }],
      }),
    ).toEqual({ nested: [{ value: 1 }] });
  });

  it("writes the fixture to the requested path", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "seed-fixture-"));
    const file = path.join(directory, "nested", "fixture.json");
    const fixture = { version: 1 as const, tenants: [], pages: [], media: [] };

    await writeFixture(file, fixture);

    await expect(fs.readFile(file, "utf8")).resolves.toBe(
      `${JSON.stringify(fixture, null, 2)}\n`,
    );
  });

  it("reads every Payload page when a result spans more than 1,000 records", async () => {
    const calls: number[] = [];
    const docs = await readAllPages(async (page) => {
      calls.push(page);
      return {
        docs: Array.from(
          { length: page === 1 ? 1000 : 3 },
          (_, index) => page * 1000 + index,
        ),
        hasNextPage: page === 1,
        nextPage: 2,
      };
    });

    expect(docs).toHaveLength(1003);
    expect(calls).toEqual([1, 2]);
  });

  it("finds nested media refs before an import can write pages", () => {
    expect(
      collectMediaRefs({ layout: [{ image: { ref: "hero.png" } }] }),
    ).toEqual(["hero.png"]);
  });

  it("treats a second import of normalized records as unchanged", () => {
    const fixture = {
      slug: "home",
      tenant: "tenant-id",
      layout: [{ id: "generated", heading: "Welcome" }],
    };
    expect(
      recordsChanged(
        { ...fixture, id: "payload-id", createdAt: "now", updatedAt: "now" },
        fixture,
      ),
    ).toBe(false);
  });
});
