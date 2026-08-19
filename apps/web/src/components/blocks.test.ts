import { describe, expect, it } from "vitest";
import { mediaURL } from "../lib/media";

describe("mediaURL", () => {
  it("resolves relative media paths against the CMS origin", () => {
    expect(mediaURL("/api/media/file/studio-mark.svg")).toBe(
      "http://localhost:3001/api/media/file/studio-mark.svg",
    );
  });

  it("preserves absolute media URLs", () => {
    expect(mediaURL("https://cdn.example.test/image.svg")).toBe(
      "https://cdn.example.test/image.svg",
    );
  });
});
