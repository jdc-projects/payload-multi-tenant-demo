import { describe, expect, it } from "vitest";
import { pageBlocks } from "./blocks";

describe("page block registry", () => {
  it("exposes the code-owned component library", () => {
    expect(pageBlocks.map((block) => block.slug)).toEqual([
      "hero",
      "richText",
      "callToAction",
      "image",
      "video",
      "featureGrid",
    ]);
  });
});
