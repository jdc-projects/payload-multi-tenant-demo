import { describe, expect, it } from "vitest";
import { mediaMaxWidth } from "./media-size";

describe("mediaMaxWidth", () => {
  it("keeps each editor size distinct at responsive preview widths", () => {
    expect([
      mediaMaxWidth("full"),
      mediaMaxWidth("large"),
      mediaMaxWidth("medium"),
      mediaMaxWidth("narrow"),
    ]).toEqual(["100%", "85%", "70%", "50%"]);
  });
});
