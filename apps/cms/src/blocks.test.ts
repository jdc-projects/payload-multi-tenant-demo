import { describe, expect, it } from "vitest";
import { pageBlocks } from "./blocks.js";

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

  it("requires alternatives for uploaded images", () => {
    const image = pageBlocks.find((block) => block.slug === "image");
    const alt = image?.fields.find(
      (field) => "name" in field && field.name === "alt",
    );
    expect(alt).toMatchObject({ name: "alt", required: true });
  });

  it("gives media blocks a stable editor-controlled aspect ratio", () => {
    for (const slug of ["hero", "image", "video"]) {
      const block = pageBlocks.find((item) => item.slug === slug);
      expect(
        block?.fields.find(
          (field) => "name" in field && field.name === "aspectRatio",
        ),
      ).toMatchObject({ name: "aspectRatio", defaultValue: "16:9" });
    }
  });

  it("gives media blocks an editor-controlled size", () => {
    for (const slug of ["hero", "image", "video"]) {
      const block = pageBlocks.find((item) => item.slug === slug);
      expect(
        block?.fields.find(
          (field) => "name" in field && field.name === "mediaSize",
        ),
      ).toMatchObject({
        name: "mediaSize",
        defaultValue: "full",
        options: ["full", "large", "medium", "narrow"],
      });
    }
  });
});
