import { describe, expect, it } from "vitest";
import { mediaURL } from "../lib/media";

describe("mediaURL", () => {
  it("routes Payload media paths through the public media proxy", () => {
    expect(mediaURL("/api/media/file/studio-mark.svg")).toBe(
      "/media/studio-mark.svg",
    );
  });

  it("routes absolute CMS media paths through the public media proxy", () => {
    expect(
      mediaURL("http://localhost:3001/api/media/file/studio-mark.svg"),
    ).toBe("/media/studio-mark.svg");
  });

  it("preserves absolute media URLs", () => {
    expect(mediaURL("https://cdn.example.test/image.svg")).toBe(
      "https://cdn.example.test/image.svg",
    );
  });
});
