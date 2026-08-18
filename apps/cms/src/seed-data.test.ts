import { describe, expect, it } from "vitest";
import { fixturePath, normalize, readFixture } from "./seed-data.js";

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
});
