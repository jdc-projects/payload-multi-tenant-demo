import { describe, expect, it } from "vitest";
import { getTenants } from "./cms";

describe("tenant mapping", () => {
  it("contains the three deterministic demo tenants", async () => {
    await expect(getTenants()).resolves.toEqual(["demo1", "demo2", "demo3"]);
  });
});
