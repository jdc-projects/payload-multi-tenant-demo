import { afterEach, describe, expect, it, vi } from "vitest";
import { getTenants } from "./cms";

afterEach(() => vi.unstubAllGlobals());

describe("tenant mapping", () => {
  it("contains the three deterministic demo tenants", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            docs: [{ slug: "demo1" }, { slug: "demo2" }, { slug: "demo3" }],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(getTenants()).resolves.toEqual(["demo1", "demo2", "demo3"]);
  });
});
