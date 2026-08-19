import { describe, expect, it } from "vitest";
import { mergeMedia } from "./live-preview";

describe("mergeMedia", () => {
  const current = [
    {
      id: "hero",
      blockType: "hero",
      image: { id: "image-a", url: "/media/a.svg" },
    },
    { id: "text", blockType: "richText" },
  ];

  it("retains populated media when Payload sends the same media ID", () => {
    expect(
      mergeMedia(current, [
        { id: "hero", blockType: "hero", image: "image-a" },
      ])[0]?.image,
    ).toEqual({ id: "image-a", url: "/media/a.svg" });
  });

  it("honors an explicit media removal", () => {
    expect(
      mergeMedia(current, [{ id: "hero", blockType: "hero", image: null }])[0]
        ?.image,
    ).toBeNull();
  });

  it("does not attach media by position after blocks are reordered", () => {
    expect(
      mergeMedia(current, [
        { id: "text", blockType: "richText" },
        { id: "new", blockType: "image", image: "image-b" },
      ]),
    ).toEqual([
      { id: "text", blockType: "richText" },
      { id: "new", blockType: "image", image: "image-b" },
    ]);
  });
});
